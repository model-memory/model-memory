import type { PageServerLoad } from './$types';
import { gateway } from '$lib/server/gateway';

// Read-only: there is no app-level auth. All writes (new questions,
// refreshes, weekly opt-in) go through the x402-paid POST /api/commission,
// with the settling EVM address as the user identity.
const RUNS_PER_PAGE = 30;

export const load: PageServerLoad = async ({ platform, url }) => {
	const gw = gateway(platform);
	const pageParam = Number(url.searchParams.get('page') ?? 1);
	const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
	const empty = {
		available: false,
		questions: [],
		runs: [],
		balances: { global_credits: 0, questions: [] },
		page,
		hasOlder: false
	};
	if (!gw) return empty;

	try {
		// Fetch one extra row to know whether an older page exists.
		const [questions, runs, balances] = await Promise.all([
			gw.listQuestions(true),
			gw.listRuns({ limit: RUNS_PER_PAGE + 1, offset: (page - 1) * RUNS_PER_PAGE }),
			gw.getBalances()
		]);
		return {
			available: true,
			questions,
			runs: runs.slice(0, RUNS_PER_PAGE),
			balances,
			page,
			hasOlder: runs.length > RUNS_PER_PAGE
		};
	} catch (err) {
		console.error('archive load failed:', err);
		return empty;
	}
};
