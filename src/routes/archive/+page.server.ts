import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { gateway } from '$lib/server/gateway';

export const load: PageServerLoad = async ({ platform }) => {
	const gw = gateway(platform);
	const empty = {
		available: false,
		questions: [],
		runs: [],
		balances: { global_credits: 0, questions: [] }
	};
	if (!gw) return empty;

	try {
		const [questions, runs, balances] = await Promise.all([
			gw.listQuestions(true),
			gw.listRuns({ limit: 30 }),
			gw.getBalances()
		]);
		return { available: true, questions, runs, balances };
	} catch (err) {
		console.error('archive load failed:', err);
		return empty;
	}
};

export const actions: Actions = {
	// Operator path: track a question and fan it out without payment.
	// Public commissioning goes through POST /api/commission (x402).
	ask: async ({ request, platform }) => {
		const gw = gateway(platform);
		if (!gw) return fail(503, { message: 'Gateway unavailable.' });

		const form = await request.formData();
		const prompt = String(form.get('prompt') ?? '').trim();
		if (!prompt) return fail(400, { message: 'Enter a question.' });

		const question = await gw.addQuestion(prompt);
		const run = await gw.createRun(prompt, { questionId: question.id });
		redirect(303, `/archive/${run.id}`);
	},

	weekly: async ({ request, platform }) => {
		const gw = gateway(platform);
		if (!gw) return fail(503, { message: 'Gateway unavailable.' });

		const form = await request.formData();
		const questionId = String(form.get('questionId') ?? '');
		const weekly = form.get('weekly') === 'true';
		if (!questionId) return fail(400, { message: 'Missing question.' });

		await gw.setQuestionWeekly(questionId, weekly);
		return { ok: true };
	}
};
