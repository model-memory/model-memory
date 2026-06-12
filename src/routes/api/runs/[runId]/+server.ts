import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gateway } from '$lib/server/gateway';

// Public, machine-readable run record — the "exportable, citable" surface,
// and the polling endpoint for commission clients awaiting a running fan-out.
export const GET: RequestHandler = async ({ params, platform }) => {
	const gw = gateway(platform);
	if (!gw) return json({ error: 'gateway unavailable' }, { status: 503 });

	try {
		const detail = await gw.getRun(params.runId);
		const completed = detail.run.status === 'completed';
		return json(detail, {
			headers: {
				// Completed runs are immutable; running ones change as models land.
				'cache-control': completed ? 'public, max-age=3600' : 'no-store'
			}
		});
	} catch {
		return json({ error: 'run not found' }, { status: 404 });
	}
};
