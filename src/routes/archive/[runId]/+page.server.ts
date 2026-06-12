import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { gateway } from '$lib/server/gateway';

export const load: PageServerLoad = async ({ params, platform }) => {
	const gw = gateway(platform);
	if (!gw) error(503, 'Gateway unavailable');

	try {
		const detail = await gw.getRun(params.runId);
		return { detail };
	} catch {
		error(404, 'Run not found');
	}
};
