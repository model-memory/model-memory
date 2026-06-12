import type { RequestHandler } from './$types';
import { gateway } from '$lib/server/gateway';
import { productKey } from '$lib/products';

export const GET: RequestHandler = async ({ platform, url }) => {
	const gw = gateway(platform);
	const origin = url.origin;
	const urls = new Set<string>([
		`${origin}/`,
		`${origin}/archive`,
		`${origin}/shifts`,
		`${origin}/commission`
	]);

	if (gw) {
		try {
			const [questions, picks] = await Promise.all([
				gw.listQuestions(false),
				gw.listExtractedPicks(5000)
			]);
			for (const q of questions) {
				urls.add(`${origin}/archive/q/${q.id}`);
				if (q.category) urls.add(`${origin}/category/${encodeURIComponent(q.category)}`);
			}
			for (const p of picks) {
				urls.add(`${origin}/products/${encodeURIComponent(productKey(p.recommended_product))}`);
			}
		} catch (err) {
			console.error('sitemap load failed:', err);
		}
	}

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls].map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;

	return new Response(body, {
		headers: {
			'content-type': 'application/xml',
			'cache-control': 'public, max-age=3600'
		}
	});
};
