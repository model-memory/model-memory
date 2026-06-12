import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gateway } from '$lib/server/gateway';

// Public, machine-readable trend data for one tracked question: runs
// newest-first with each run's extracted picks, plus funder addresses.
export const GET: RequestHandler = async ({ params, platform, url }) => {
	const gw = gateway(platform);
	if (!gw) return json({ error: 'gateway unavailable' }, { status: 503 });

	const limitParam = Number(url.searchParams.get('limit') ?? 52);
	const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 52;

	try {
		const history = await gw.getQuestionHistory(params.questionId, limit);
		return json(history, {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch {
		return json({ error: 'question not found' }, { status: 404 });
	}
};
