import type { PageServerLoad } from './$types';
import { gateway } from '$lib/server/gateway';
import { x402Config } from '$lib/server/x402';

export const load: PageServerLoad = async ({ platform, url }) => {
	const cfg = platform ? x402Config(platform.env) : null;
	const gw = gateway(platform);

	// Prefill from links like /commission?questionId=...
	const questionId = url.searchParams.get('questionId') ?? '';
	let questionText = '';
	if (gw && questionId) {
		try {
			questionText = (await gw.getQuestion(questionId))?.text ?? '';
		} catch {
			questionText = '';
		}
	}

	return {
		enabled: cfg !== null,
		network: cfg?.network ?? null,
		creditPriceUsdcMicro: cfg?.creditPriceUsdcMicro ?? null,
		prefill: {
			questionId: questionText ? questionId : '',
			questionText,
			prompt: url.searchParams.get('prompt') ?? ''
		}
	};
};
