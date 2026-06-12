import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gateway, type LlmGateway, type PaymentAllocation } from '$lib/server/gateway';
import { challenge, paymentRequirements, verifyAndSettle, x402Config } from '$lib/server/x402';

// Paid commissioning via x402. One payment buys `credits` refreshes,
// allocated to all queries, a subset, or a single query. One credit is
// spent immediately on the target question (unless refresh: false); the
// remaining buffer funds that allocation's weekly refreshes.
//
// Every request shape is fully normalized and validated BEFORE the 402
// challenge is issued, so a request that would fail fulfillment can never
// settle a payment.

type CommissionBody = {
	prompt?: string;
	questionId?: string;
	credits?: number;
	allocation?: PaymentAllocation;
	questionIds?: string[];
	weekly?: boolean;
	refresh?: boolean;
};

type Commission = {
	credits: number;
	allocation: PaymentAllocation;
	/** new question to create after settlement (mutually exclusive with targetId) */
	prompt?: string;
	/** existing question targeted for the immediate refresh */
	targetId?: string;
	/** existing question ids the payment links to (subset only; excludes prompt) */
	linkIds: string[];
	weekly?: boolean;
	refresh: boolean;
};

function invalid(message: string): { error: string } {
	return { error: message };
}

// Normalize + validate the request into an unambiguous commission, mirroring
// the gateway's recordPayment rules. Returns a string error for any shape
// that could fail after payment.
function parseCommission(body: CommissionBody): Commission | string {
	const credits = Math.floor(body.credits ?? 1);
	if (!Number.isFinite(credits) || credits < 1 || credits > 1000) {
		return 'credits must be between 1 and 1000';
	}

	const prompt = body.prompt?.trim() || undefined;
	const questionId = body.questionId?.trim() || undefined;
	const questionIds = [...new Set((body.questionIds ?? []).map((id) => id.trim()).filter(Boolean))];
	if (questionIds.length > 100) {
		return 'questionIds must list at most 100 questions';
	}
	if (prompt && questionId) {
		return 'pass either prompt (new question) or questionId (existing), not both';
	}

	const hasTarget = Boolean(prompt || questionId);
	const allocation: PaymentAllocation =
		body.allocation ?? (hasTarget ? 'single' : questionIds.length > 0 ? 'subset' : 'all');

	if (allocation === 'all') {
		if (questionIds.length > 0) {
			return "allocation 'all' must not list questionIds";
		}
		return {
			credits,
			allocation,
			prompt,
			targetId: questionId,
			linkIds: [],
			weekly: body.weekly,
			refresh: body.refresh !== false
		};
	}

	if (allocation === 'single') {
		// The single funded question: prompt, questionId, or a lone questionIds entry.
		if (questionIds.length > 1) {
			return "allocation 'single' funds exactly one question";
		}
		const fromList = questionIds[0];
		if (hasTarget && fromList) {
			return "allocation 'single': pass the question once (prompt/questionId or questionIds)";
		}
		const targetId = questionId ?? fromList;
		if (!prompt && !targetId) {
			return "allocation 'single' needs a prompt, questionId, or one questionIds entry";
		}
		return {
			credits,
			allocation,
			prompt,
			targetId,
			linkIds: targetId ? [targetId] : [],
			weekly: body.weekly,
			refresh: body.refresh !== false
		};
	}

	// subset: the payment links to questionIds plus the target (if any).
	const linkIds = [...new Set([...questionIds, ...(questionId ? [questionId] : [])])];
	if (linkIds.length === 0 && !prompt) {
		return "allocation 'subset' needs questionIds (and/or a prompt or questionId)";
	}
	return {
		credits,
		allocation,
		prompt,
		targetId: questionId,
		linkIds,
		weekly: body.weekly,
		refresh: body.refresh !== false
	};
}

// Verify every referenced existing question id before any payment is taken.
async function findMissingQuestion(gw: LlmGateway, ids: string[]): Promise<string | null> {
	for (const id of ids) {
		if ((await gw.getQuestion(id)) === null) return id;
	}
	return null;
}

export const GET: RequestHandler = ({ platform, url }) => {
	const cfg = platform ? x402Config(platform.env) : null;
	return json({
		service: 'Model Memory commissioning',
		protocol: 'x402 (v1)',
		enabled: cfg !== null,
		network: cfg?.network ?? null,
		credit_price_usdc_micro: cfg?.creditPriceUsdcMicro ?? null,
		how: `POST ${url.origin}/api/commission with an x402 client (e.g. x402-fetch). Body: { prompt | questionId, credits?, allocation? ('single'|'subset'|'all'), questionIds?, weekly?, refresh? }`
	});
};

export const POST: RequestHandler = async ({ platform, request, url }) => {
	const gw = gateway(platform);
	const cfg = platform ? x402Config(platform.env) : null;
	if (!gw) return json(invalid('gateway unavailable'), { status: 503 });
	if (!cfg) return json(invalid('payments not configured'), { status: 503 });

	let body: CommissionBody;
	try {
		body = (await request.clone().json()) as CommissionBody;
	} catch {
		return json(invalid('invalid JSON body'), { status: 400 });
	}

	const commission = parseCommission(body);
	if (typeof commission === 'string') {
		return json(invalid(commission), { status: 400 });
	}

	const referenced = [
		...new Set([...commission.linkIds, ...(commission.targetId ? [commission.targetId] : [])])
	];
	const missing = await findMissingQuestion(gw, referenced);
	if (missing) {
		return json(invalid(`question ${missing} does not exist`), { status: 400 });
	}

	const amountUsdcMicro = commission.credits * cfg.creditPriceUsdcMicro;
	const requirements = paymentRequirements(
		cfg,
		url.href,
		amountUsdcMicro,
		`${commission.credits} Model Memory refresh credit${commission.credits === 1 ? '' : 's'} (${commission.allocation})`
	);

	if (!request.headers.get('X-PAYMENT')) {
		return challenge(requirements);
	}

	const outcome = await verifyAndSettle(cfg, request, requirements);
	if (!outcome.ok) {
		if (outcome.status === 402) return challenge(requirements, outcome.error);
		return json(invalid(outcome.error), { status: outcome.status });
	}

	// Payment settled — fulfill. Everything below was validated up front.
	let targetQuestionId = commission.targetId;
	let linkIds = commission.linkIds;
	if (commission.prompt) {
		targetQuestionId = (await gw.addQuestion(commission.prompt)).id;
		if (commission.allocation !== 'all') {
			linkIds = [...new Set([...linkIds, targetQuestionId])];
		}
	}
	if (targetQuestionId && commission.weekly !== undefined) {
		await gw.setQuestionWeekly(targetQuestionId, commission.weekly);
	}

	const payment = await gw.recordPayment({
		payer: outcome.settlement.payer ?? undefined,
		network: outcome.settlement.network,
		transactionRef: outcome.settlement.transaction ?? undefined,
		amountUsdcMicro,
		credits: commission.credits,
		allocation: commission.allocation,
		questionIds: commission.allocation === 'all' ? undefined : linkIds
	});

	let run = null;
	if (targetQuestionId && commission.refresh) {
		const refreshed = await gw.refreshQuestion(targetQuestionId);
		run = refreshed.run;
		// Keep the reported buffer accurate when the refresh debited this payment.
		if (refreshed.payment_id === payment.id) {
			payment.credits_remaining = refreshed.credits_remaining;
		}
	}

	const balances = await gw.getBalances();
	return json(
		{ payment, run, question_id: targetQuestionId ?? null, balances },
		{ headers: { 'X-PAYMENT-RESPONSE': outcome.settlement.responseHeader } }
	);
};
