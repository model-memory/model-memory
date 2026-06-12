import type { PageServerLoad } from './$types';
import { gateway } from '$lib/server/gateway';
import { computeShifts } from '$lib/shifts';

export const load: PageServerLoad = async ({ platform }) => {
	const gw = gateway(platform);
	if (!gw) return { shifts: [], available: false };

	try {
		const picks = await gw.listExtractedPicks(5000);
		return { shifts: computeShifts(picks), available: true };
	} catch (err) {
		console.error('shifts load failed:', err);
		return { shifts: [], available: false };
	}
};
