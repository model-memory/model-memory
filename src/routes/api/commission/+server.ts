import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gateway, type PaymentAllocation } from '$lib/server/gateway';
import { challenge, paymentRequirements, verifyAndSettle, x402Config } from '$lib/server/x402';

// Paid commissioning via x402. One payment buys `credits` refreshes,
// allocated to all queries, a subset, or a single query. One credit is
// spent immediately on the target question (unless refresh: false); the
// remaining buffer funds that allocation's weekly refreshes.

type CommissionBody = {
	prompt?: string;
	questionId?: string;
	credits?: number;
	allocation?: PaymentAllocation;
	questionIds?: string[];
	weekly?: boolean;
	refresh?: boolean;
};

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
	if (!gw) return json({ error: 'gateway unavailable' }, { status: 503 });
	if (!cfg) return json({ error: 'payments not configured' }, { status: 503 });

	let body: CommissionBody;
	try {
		body = (await request.clone().json()) as CommissionBody;
	} catch {
		return json({ error: 'invalid JSON body' }, { status: 400 });
	}

	const credits = Math.floor(body.credits ?? 1);
	if (!Number.isFinite(credits) || credits < 1 || credits > 1000) {
		return json({ error: 'credits must be between 1 and 1000' }, { status: 400 });
	}

	const prompt = body.prompt?.trim();
	const hasTarget = Boolean(prompt || body.questionId);
	const allocation: PaymentAllocation = body.allocation ?? (hasTarget ? 'single' : 'all');
	if (allocation !== 'all' && !hasTarget && !(body.questionIds?.length ?? 0)) {
		return json(
			{ error: 'scoped allocations need a prompt, questionId, or questionIds' },
			{ status: 400 }
		);
	}

	const amountUsdcMicro = credits * cfg.creditPriceUsdcMicro;
	const requirements = paymentRequirements(
		cfg,
		url.href,
		amountUsdcMicro,
		`${credits} Model Memory refresh credit${credits === 1 ? '' : 's'} (${allocation})`
	);

	if (!request.headers.get('X-PAYMENT')) {
		return challenge(requirements);
	}

	const outcome = await verifyAndSettle(cfg, request, requirements);
	if (!outcome.ok) {
		if (outcome.status === 402) return challenge(requirements, outcome.error);
		return json({ error: outcome.error }, { status: outcome.status });
	}

	// Payment settled — fulfill. Resolve the target question first so the
	// payment can be linked to it.
	let targetQuestionId = body.questionId;
	if (!targetQuestionId && prompt) {
		targetQuestionId = (await gw.addQuestion(prompt)).id;
	}
	if (targetQuestionId && body.weekly !== undefined) {
		await gw.setQuestionWeekly(targetQuestionId, body.weekly);
	}

	let questionIds: string[] | undefined;
	if (allocation === 'single') {
		questionIds = targetQuestionId ? [targetQuestionId] : [];
	} else if (allocation === 'subset') {
		questionIds = [
			...new Set([...(body.questionIds ?? []), ...(targetQuestionId ? [targetQuestionId] : [])])
		];
	}

	const payment = await gw.recordPayment({
		payer: outcome.settlement.payer ?? undefined,
		network: outcome.settlement.network,
		transactionRef: outcome.settlement.transaction ?? undefined,
		amountUsdcMicro,
		credits,
		allocation,
		questionIds
	});

	let run = null;
	if (targetQuestionId && body.refresh !== false) {
		run = (await gw.refreshQuestion(targetQuestionId)).run;
	}

	const balances = await gw.getBalances();
	return json(
		{ payment, run, question_id: targetQuestionId ?? null, balances },
		{ headers: { 'X-PAYMENT-RESPONSE': outcome.settlement.responseHeader } }
	);
};
