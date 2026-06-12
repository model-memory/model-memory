import { describe, expect, it } from 'vitest';
import { computeShifts, type ShiftPick } from './shifts';

function pick(
	runId: string,
	at: number,
	product: string,
	model = 'm1',
	questionId = 'q1'
): ShiftPick {
	return {
		run_id: runId,
		run_created_at: at,
		question_id: questionId,
		question_text: 'Where to host?',
		category: 'hosting',
		model,
		recommended_product: product
	};
}

describe('computeShifts', () => {
	it('detects a consensus flip between consecutive runs', () => {
		const shifts = computeShifts([
			pick('r1', 100, 'Vercel', 'a'),
			pick('r1', 100, 'Vercel', 'b'),
			pick('r2', 200, 'Cloudflare', 'a'),
			pick('r2', 200, 'Cloudflare', 'b'),
			pick('r2', 200, 'Vercel', 'c')
		]);
		expect(shifts).toHaveLength(1);
		expect(shifts[0]).toMatchObject({
			from: 'Vercel',
			to: 'Cloudflare',
			count: 2,
			of: 3,
			run_id: 'r2',
			at: 200
		});
	});

	it('ignores respellings of the same product', () => {
		const shifts = computeShifts([pick('r1', 100, 'Vercel'), pick('r2', 200, 'vercel.com')]);
		expect(shifts).toHaveLength(0);
	});

	it('tracks questions independently and sorts newest first', () => {
		const shifts = computeShifts([
			pick('r1', 100, 'Vercel', 'a', 'q1'),
			pick('r2', 200, 'Netlify', 'a', 'q1'),
			pick('r3', 150, 'Supabase', 'a', 'q2'),
			pick('r4', 300, 'Neon', 'a', 'q2')
		]);
		expect(shifts.map((s) => s.run_id)).toEqual(['r4', 'r2']);
	});

	it('returns nothing for stable consensus or single runs', () => {
		expect(computeShifts([pick('r1', 100, 'Vercel')])).toEqual([]);
		expect(computeShifts([pick('r1', 100, 'Vercel'), pick('r2', 200, 'Vercel')])).toEqual([]);
	});
});
