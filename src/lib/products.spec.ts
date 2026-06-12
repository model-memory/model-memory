import { describe, expect, it } from 'vitest';
import { productKey, tallyProductCounts, tallyProducts } from './products';

describe('productKey', () => {
	it('canonicalizes case, articles, possessives, and TLDs', () => {
		expect(productKey('Vercel')).toBe('vercel');
		expect(productKey('vercel.com')).toBe('vercel');
		expect(productKey("Vercel's platform")).toBe('vercel platform');
		expect(productKey('The Supabase')).toBe('supabase');
		expect(productKey('  Cloudflare   Pages ')).toBe('cloudflare pages');
	});
});

describe('tallyProducts', () => {
	it('groups spellings under one product and keeps the common form', () => {
		const tally = tallyProducts(['Vercel', 'vercel.com', 'Vercel', 'Cloudflare Pages', null]);
		expect(tally[0]).toEqual({ name: 'Vercel', count: 3 });
		expect(tally[1]).toEqual({ name: 'Cloudflare Pages', count: 1 });
	});

	it('ignores empty and null entries', () => {
		expect(tallyProducts([null, undefined, '  '])).toEqual([]);
	});
});

describe('tallyProductCounts', () => {
	it('merges weighted pre-aggregated counts across spellings', () => {
		const tally = tallyProductCounts([
			{ name: 'Vercel', count: 5 },
			{ name: 'vercel.com', count: 2 },
			{ name: 'Netlify', count: 4 }
		]);
		expect(tally[0]).toEqual({ name: 'Vercel', count: 7 });
		expect(tally[1]).toEqual({ name: 'Netlify', count: 4 });
	});
});
