import type { PageServerLoad } from './$types';
import { gateway } from '$lib/server/gateway';

// Surface the latest archived run on the homepage; the page falls back to
// its printed specimen when the gateway is unreachable or empty.
export const load: PageServerLoad = async ({ platform }) => {
	const gw = gateway(platform);
	if (!gw) return { latest: null };

	try {
		const runs = await gw.listRuns({ limit: 10 });
		const candidate = runs.find((r) => r.status === 'completed') ?? runs[0];
		if (!candidate) return { latest: null };
		return { latest: await gw.getRun(candidate.id) };
	} catch (err) {
		console.error('homepage latest-run load failed:', err);
		return { latest: null };
	}
};
