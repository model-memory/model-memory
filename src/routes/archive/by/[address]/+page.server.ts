import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { gateway } from '$lib/server/gateway';

export const load: PageServerLoad = async ({ params, platform }) => {
	const gw = gateway(platform);
	if (!gw) error(503, 'Gateway unavailable');

	try {
		return { profile: await gw.getPayerProfile(params.address) };
	} catch {
		error(400, 'Invalid address');
	}
};
