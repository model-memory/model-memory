import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './+server';
import type {
	LlmGateway,
	PaymentRow,
	QuestionRow,
	RecordPaymentInput,
	RunSummary
} from '$lib/server/gateway';

// Integration tests for the paid commission flow, with the x402 facilitator
// mocked at the fetch layer and the gateway mocked in memory (mirroring the
// real gateway's validation + idempotency semantics).

const FACILITATOR = 'https://facilitator.test';

type MockGateway = LlmGateway & {
	state: {
		questions: Map<string, QuestionRow>;
		payments: PaymentRow[];
		links: Map<string, string[]>;
		runs: RunSummary[];
		mints: number;
	};
	seedQuestion(text: string): QuestionRow;
};

function mockGateway(): MockGateway {
	const questions = new Map<string, QuestionRow>();
	const payments: PaymentRow[] = [];
	const links = new Map<string, string[]>();
	const runs: RunSummary[] = [];
	const state = { questions, payments, links, runs, mints: 0 };

	function seedQuestion(text: string): QuestionRow {
		const q: QuestionRow = {
			id: `q${questions.size + 1}`,
			text,
			active: 1,
			weekly: 1,
			created_at: 1
		};
		questions.set(q.id, q);
		return q;
	}

	const gw: Partial<LlmGateway> = {
		async getQuestion(id) {
			return questions.get(id) ?? null;
		},
		async addQuestion(text) {
			const existing = [...questions.values()].find((q) => q.text === text);
			return existing ?? seedQuestion(text);
		},
		async setQuestionWeekly(id, weekly) {
			const q = questions.get(id);
			if (!q) throw new Error(`question ${id} not found`);
			q.weekly = weekly ? 1 : 0;
		},
		async recordPayment(input: RecordPaymentInput) {
			if (input.transactionRef) {
				const existing = payments.find((p) => p.transaction_ref === input.transactionRef);
				if (existing) return { ...existing };
			}
			if (input.allocation === 'single' && (input.questionIds ?? []).length !== 1) {
				throw new Error("allocation 'single' requires exactly one questionId");
			}
			if (input.allocation === 'subset' && (input.questionIds ?? []).length === 0) {
				throw new Error("allocation 'subset' requires at least one questionId");
			}
			if (input.allocation === 'all' && (input.questionIds ?? []).length > 0) {
				throw new Error("allocation 'all' must not list questionIds");
			}
			for (const id of input.questionIds ?? []) {
				if (!questions.has(id)) throw new Error('one or more questionIds do not exist');
			}
			state.mints += 1;
			const payment: PaymentRow = {
				id: `p${payments.length + 1}`,
				payer: input.payer ?? null,
				network: input.network ?? null,
				transaction_ref: input.transactionRef ?? null,
				amount_usdc_micro: input.amountUsdcMicro,
				credits: input.credits,
				credits_remaining: input.credits,
				allocation: input.allocation,
				created_at: 1
			};
			payments.push(payment);
			links.set(payment.id, [...(input.questionIds ?? [])]);
			return { ...payment };
		},
		async refreshQuestion(questionId) {
			const question = questions.get(questionId);
			if (!question) throw new Error(`question ${questionId} not found`);
			const funding = payments.find(
				(p) =>
					p.credits_remaining > 0 &&
					(p.allocation === 'all' || (links.get(p.id) ?? []).includes(questionId))
			);
			if (!funding) throw new Error(`no refresh buffer available for question ${questionId}`);
			funding.credits_remaining -= 1;
			const run: RunSummary = {
				id: `r${runs.length + 1}`,
				prompt: question.text,
				status: 'running',
				model_count: 13,
				question_id: questionId,
				created_at: 1,
				completed_at: null
			};
			runs.push(run);
			return { run, payment_id: funding.id, credits_remaining: funding.credits_remaining };
		},
		async getBalances() {
			const global = payments
				.filter((p) => p.allocation === 'all')
				.reduce((s, p) => s + p.credits_remaining, 0);
			const perQuestion = new Map<string, number>();
			for (const p of payments) {
				for (const qid of links.get(p.id) ?? []) {
					perQuestion.set(qid, (perQuestion.get(qid) ?? 0) + p.credits_remaining);
				}
			}
			return {
				global_credits: global,
				questions: [...perQuestion.entries()].map(([question_id, available_credits]) => ({
					question_id,
					available_credits
				}))
			};
		}
	};

	return Object.assign(gw as LlmGateway, { state, seedQuestion });
}

type Facilitator = {
	verify: { isValid: boolean; invalidReason?: string };
	settle: {
		success: boolean;
		errorReason?: string;
		transaction?: string;
		network?: string;
		payer?: string;
	};
	calls: string[];
};

function stubFacilitator(): Facilitator {
	const facilitator: Facilitator = {
		verify: { isValid: true },
		settle: { success: true, transaction: '0xtx1', network: 'base-sepolia', payer: '0xPAYER' },
		calls: []
	};
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === `${FACILITATOR}/verify`) {
				facilitator.calls.push('verify');
				return Response.json(facilitator.verify);
			}
			if (url === `${FACILITATOR}/settle`) {
				facilitator.calls.push('settle');
				return Response.json(facilitator.settle);
			}
			throw new Error(`unexpected fetch: ${url}`);
		})
	);
	return facilitator;
}

function makePlatform(gw: MockGateway): App.Platform {
	return {
		env: {
			LLM_GATEWAY: gw,
			X402_PAY_TO: '0xRECEIVER',
			X402_NETWORK: 'base-sepolia',
			X402_FACILITATOR_URL: FACILITATOR,
			X402_ASSET: '0xUSDC',
			X402_CREDIT_PRICE_USDC_MICRO: '50000'
		}
	} as unknown as App.Platform;
}

function post(gw: MockGateway, body: unknown, paid = false): Promise<Response> {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (paid) {
		headers['X-PAYMENT'] = btoa(
			JSON.stringify({ x402Version: 1, scheme: 'exact', network: 'base-sepolia', payload: {} })
		);
	}
	const request = new Request('https://site.test/api/commission', {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});
	const event = {
		platform: makePlatform(gw),
		request,
		url: new URL(request.url)
	} as unknown as Parameters<typeof POST>[0];
	return Promise.resolve(POST(event));
}

let gw: MockGateway;
let facilitator: Facilitator;

beforeEach(() => {
	gw = mockGateway();
	facilitator = stubFacilitator();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GET /api/commission', () => {
	it('reports pricing and enablement', async () => {
		const event = {
			platform: makePlatform(gw),
			url: new URL('https://site.test/api/commission')
		} as unknown as Parameters<typeof GET>[0];
		const res = await GET(event);
		const body = (await res.json()) as { enabled: boolean; credit_price_usdc_micro: number };
		expect(body.enabled).toBe(true);
		expect(body.credit_price_usdc_micro).toBe(50000);
	});
});

describe('POST /api/commission — challenge and validation', () => {
	it('returns a 402 challenge priced at credits * unit price', async () => {
		const res = await post(gw, { prompt: 'Where to host?', credits: 4 });
		expect(res.status).toBe(402);
		const body = (await res.json()) as {
			x402Version: number;
			accepts: { maxAmountRequired: string }[];
		};
		expect(body.x402Version).toBe(1);
		expect(body.accepts[0].maxAmountRequired).toBe('200000');
		expect(facilitator.calls).toEqual([]);
	});

	it('rejects invalid shapes before any payment interaction', async () => {
		const cases = [
			{ allocation: 'single', questionIds: ['a', 'b'] },
			{ allocation: 'all', questionIds: ['a'] },
			{ allocation: 'subset' },
			{ prompt: 'x', questionId: 'q1' },
			{ credits: 0, prompt: 'x' }
		];
		for (const body of cases) {
			const res = await post(gw, body);
			expect(res.status, JSON.stringify(body)).toBe(400);
		}
		expect(facilitator.calls).toEqual([]);
		expect(gw.state.mints).toBe(0);
	});

	it('rejects nonexistent question references before payment', async () => {
		const res = await post(gw, { questionId: 'nope' }, true);
		expect(res.status).toBe(400);
		expect(((await res.json()) as { error: string }).error).toContain('does not exist');
		expect(facilitator.calls).toEqual([]);
	});
});

describe('POST /api/commission — settlement and fulfillment', () => {
	it('mints credits, refreshes immediately, and reports the post-debit buffer', async () => {
		const res = await post(gw, { prompt: 'Where to host?', credits: 4, weekly: true }, true);
		expect(res.status).toBe(200);
		expect(facilitator.calls).toEqual(['verify', 'settle']);
		expect(res.headers.get('X-PAYMENT-RESPONSE')).toBeTruthy();

		const body = (await res.json()) as {
			payment: PaymentRow;
			run: RunSummary | null;
			question_id: string;
			balances: { questions: { available_credits: number }[] };
		};
		expect(body.payment.allocation).toBe('single');
		expect(body.payment.payer).toBe('0xPAYER');
		expect(body.payment.credits).toBe(4);
		expect(body.payment.credits_remaining).toBe(3); // 1 spent on the immediate refresh
		expect(body.run?.question_id).toBe(body.question_id);
		expect(body.balances.questions[0].available_credits).toBe(3);
		expect(gw.state.questions.get(body.question_id)?.weekly).toBe(1);
	});

	it('treats bare questionIds as a subset top-up with no refresh', async () => {
		const a = gw.seedQuestion('a');
		const b = gw.seedQuestion('b');
		const res = await post(gw, { questionIds: [a.id, b.id], credits: 10 }, true);
		expect(res.status).toBe(200);

		const body = (await res.json()) as { payment: PaymentRow; run: RunSummary | null };
		expect(body.payment.allocation).toBe('subset');
		expect(body.payment.credits_remaining).toBe(10);
		expect(body.run).toBeNull();
		expect(gw.state.links.get(body.payment.id)).toEqual([a.id, b.id]);
	});

	it('does not double-mint on a replayed settlement', async () => {
		const q = gw.seedQuestion('tracked');
		const first = await post(gw, { questionId: q.id, credits: 2 }, true);
		const second = await post(gw, { questionId: q.id, credits: 2 }, true);
		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(gw.state.mints).toBe(1);
		const p1 = ((await first.json()) as { payment: PaymentRow }).payment;
		const p2 = ((await second.json()) as { payment: PaymentRow }).payment;
		expect(p2.id).toBe(p1.id);
	});

	it('returns a fresh challenge when verification fails, without writes', async () => {
		facilitator.verify = { isValid: false, invalidReason: 'expired authorization' };
		const res = await post(gw, { prompt: 'Where to host?' }, true);
		expect(res.status).toBe(402);
		expect(((await res.json()) as { error: string }).error).toBe('expired authorization');
		expect(facilitator.calls).toEqual(['verify']);
		expect(gw.state.mints).toBe(0);
		expect(gw.state.runs).toHaveLength(0);
	});

	it('surfaces settlement failure as 402 without writes', async () => {
		facilitator.settle = { success: false, errorReason: 'insufficient funds' };
		const res = await post(gw, { prompt: 'Where to host?' }, true);
		expect(res.status).toBe(402);
		expect(gw.state.mints).toBe(0);
	});
});
