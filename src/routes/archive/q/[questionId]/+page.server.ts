import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { gateway } from '$lib/server/gateway';

export const load: PageServerLoad = async ({ params, platform }) => {
	const gw = gateway(platform);
	if (!gw) error(503, 'Gateway unavailable');

	try {
		const [history, balances] = await Promise.all([
			gw.getQuestionHistory(params.questionId, 52),
			gw.getBalances()
		]);
		const direct =
			balances.questions.find((b) => b.question_id === params.questionId)?.available_credits ?? 0;
		return { history, credits: direct + balances.global_credits };
	} catch {
		error(404, 'Question not found');
	}
};
