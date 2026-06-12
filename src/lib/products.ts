// Product-name canonicalization for share-of-voice aggregation. Extraction
// returns free-form names ("Vercel", "vercel.com", "Vercel's platform");
// these must count as one product when tallying.

export function productKey(name: string): string {
	let key = name.trim().toLowerCase();
	key = key.replace(/^the\s+/, '');
	key = key.replace(/['’]s\b/g, '');
	key = key.replace(/\.(com|io|dev|ai|app|sh|org|net)$/, '');
	key = key.replace(/\s+/g, ' ').trim();
	return key;
}

export type ProductTally = {
	/** most common surface form, for display */
	name: string;
	count: number;
};

// Group names by canonical key; each tally displays the most frequent
// original spelling. Sorted by count descending, ties by name.
export function tallyProducts(names: Array<string | null | undefined>): ProductTally[] {
	const groups = new Map<string, { count: number; forms: Map<string, number> }>();

	for (const raw of names) {
		if (!raw) continue;
		const name = raw.trim();
		if (!name) continue;
		const key = productKey(name);
		if (!key) continue;
		const group = groups.get(key) ?? { count: 0, forms: new Map() };
		group.count += 1;
		group.forms.set(name, (group.forms.get(name) ?? 0) + 1);
		groups.set(key, group);
	}

	return [...groups.values()]
		.map((g) => ({
			name: [...g.forms.entries()].sort((a, b) => b[1] - a[1])[0][0],
			count: g.count
		}))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
