// Consensus-shift detection: the moments a question's winning product
// changes between consecutive runs. Pure so it can be unit-tested; fed by
// the gateway's listExtractedPicks.

import { productKey, tallyProducts } from './products';

export type ShiftPick = {
	run_id: string;
	run_created_at: number;
	question_id: string;
	question_text: string;
	category: string | null;
	model: string;
	recommended_product: string;
};

export type ConsensusShift = {
	question_id: string;
	question_text: string;
	category: string | null;
	from: string;
	to: string;
	/** votes for the new consensus in the flipping run */
	count: number;
	/** named picks in the flipping run */
	of: number;
	run_id: string;
	at: number;
};

export function computeShifts(picks: ShiftPick[]): ConsensusShift[] {
	// question -> run -> picks
	const byQuestion = new Map<string, Map<string, ShiftPick[]>>();
	for (const pick of picks) {
		const runs = byQuestion.get(pick.question_id) ?? new Map<string, ShiftPick[]>();
		runs.set(pick.run_id, [...(runs.get(pick.run_id) ?? []), pick]);
		byQuestion.set(pick.question_id, runs);
	}

	const shifts: ConsensusShift[] = [];
	for (const runs of byQuestion.values()) {
		const ordered = [...runs.values()].sort((a, b) => a[0].run_created_at - b[0].run_created_at);

		let prevTop: string | null = null;
		for (const runPicks of ordered) {
			const tally = tallyProducts(runPicks.map((p) => p.recommended_product));
			const top = tally[0];
			if (!top) continue;

			if (prevTop !== null && productKey(top.name) !== productKey(prevTop)) {
				const first = runPicks[0];
				shifts.push({
					question_id: first.question_id,
					question_text: first.question_text,
					category: first.category,
					from: prevTop,
					to: top.name,
					count: top.count,
					of: runPicks.length,
					run_id: first.run_id,
					at: first.run_created_at
				});
			}
			prevTop = top.name;
		}
	}

	return shifts.sort((a, b) => b.at - a.at);
}
