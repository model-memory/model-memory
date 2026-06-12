import type { PageServerLoad } from './$types';
import { gateway } from '$lib/server/gateway';

// Read-only: there is no app-level auth. All writes (new questions,
// refreshes, weekly opt-in) go through the x402-paid POST /api/commission,
// with the settling EVM address as the user identity.
export const load: PageServerLoad = async ({ platform }) => {
	const gw = gateway(platform);
	const empty = {
		available: false,
		questions: [],
		runs: [],
		balances: { global_credits: 0, questions: [] }
	};
	if (!gw) return empty;

	try {
		const [questions, runs, balances] = await Promise.all([
			gw.listQuestions(true),
			gw.listRuns({ limit: 30 }),
			gw.getBalances()
		]);
		return { available: true, questions, runs, balances };
	} catch (err) {
		console.error('archive load failed:', err);
		return empty;
	}
};
