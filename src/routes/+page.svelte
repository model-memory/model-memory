<script lang="ts">
	import { resolve } from '$app/paths';
	import { productKey, tallyProductCounts, tallyProducts } from '$lib/products';

	let { data } = $props();

	// Printed fallback specimen, shown until the archive has a real run.
	const fallback = {
		query: 'Where should I host my SvelteKit app?',
		logged: 'Logged 2026.05.30 · 14:21 UTC',
		label: 'Entry №042',
		specimens: [
			{ model: 'GPT-5.1', answer: 'Vercel' },
			{ model: 'Claude 4.7', answer: 'Vercel' },
			{ model: 'Gemini 3.0', answer: 'Vercel' },
			{ model: 'Llama 4', answer: 'Cloudflare Pages' },
			{ model: 'DeepSeek-V4', answer: 'Vercel' }
		]
	};

	const live = $derived.by(() => {
		if (!data.latest) return null;
		const rows = data.latest.responses.filter((r) => r.recommended_product);
		if (rows.length === 0) return null;
		const d = new Date(data.latest.run.created_at * 1000);
		const pad = (n: number) => String(n).padStart(2, '0');
		return {
			query: data.latest.run.prompt,
			logged: `Logged ${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`,
			label: 'Latest entry',
			runId: data.latest.run.id,
			specimens: rows.slice(0, 5).map((r) => ({
				model: r.model.replace(/^@cf\/[^/]+\//, ''),
				answer: r.recommended_product as string
			}))
		};
	});

	const entry = $derived(live ?? fallback);
	const consensusTop = $derived(tallyProducts(entry.specimens.map((s) => s.answer))[0]);

	const fallbackInsights = [
		{ stat: '87%', label: 'of hosting queries name Vercel' },
		{ stat: '73%', label: 'of database queries name Supabase' },
		{ stat: '94%', label: 'of router queries name OpenRouter' }
	];

	// Real insights once categorized questions have enough archived picks;
	// printed numbers until then.
	const MIN_CATEGORY_PICKS = 5;
	const insights = $derived.by(() => {
		const byCategory = new Map<string, { name: string; count: number }[]>();
		for (const s of data.categoryStats) {
			byCategory.set(s.category, [
				...(byCategory.get(s.category) ?? []),
				{ name: s.product, count: s.n }
			]);
		}
		const real = [...byCategory.entries()]
			.map(([category, entries]) => {
				const tally = tallyProductCounts(entries);
				const total = tally.reduce((sum, t) => sum + t.count, 0);
				return { category, top: tally[0], total };
			})
			.filter((c) => c.total >= MIN_CATEGORY_PICKS)
			.sort((a, b) => b.total - a.total)
			.slice(0, 3)
			.map((c) => ({
				stat: `${Math.round((c.top.count / c.total) * 100)}%`,
				label: `of ${c.category} queries name ${c.top.name}`
			}));
		return real.length > 0 ? real : fallbackInsights;
	});
</script>

<svelte:head>
	<title>Model Memory — What do LLMs recommend?</title>
	<meta
		name="description"
		content="An archive of which products LLMs recommend, tracked over time. Market research for the post-search era."
	/>
</svelte:head>

<div class="paper">
	<header class="masthead">
		<div class="mark">Model Memory</div>
		<a class="meta" href={resolve('/archive')}>Vol. I &nbsp;·&nbsp; The Archive &rarr;</a>
	</header>

	<main class="page">
		<section class="hero">
			<h1>
				What do <em>the&nbsp;machines</em><br />
				recommend?
			</h1>
			<p class="subhead">
				An archive of which products LLMs recommend, tracked over time. Useful when you want to know
				who owns mindshare in your category — and how that shifts.
			</p>
		</section>

		<hr class="rule" />

		<section class="specimen">
			<div class="entry-header">
				<span class="stamp">{entry.label}</span>
				<span class="logged">{entry.logged}</span>
			</div>

			<p class="query">
				<span class="quote">&ldquo;</span>{entry.query}<span class="quote">&rdquo;</span>
			</p>

			<ul class="answers">
				{#each entry.specimens as { model, answer } (model)}
					<li class:diverges={productKey(answer) !== productKey(consensusTop.name)}>
						<span class="model">{model}</span>
						<span class="dots" aria-hidden="true"></span>
						<span class="answer">{answer}</span>
					</li>
				{/each}
			</ul>

			{#if live}
				<p class="consensus">
					Consensus {consensusTop.count}&thinsp;⁄&thinsp;{entry.specimens.length} for
					{consensusTop.name}.
					<a href={resolve('/archive/[runId]', { runId: live.runId })}>Read the full entry &rarr;</a
					>
				</p>
			{:else}
				<p class="consensus">
					Consensus 4&thinsp;⁄&thinsp;5. The dissenter is, naturally, hosted by Cloudflare.
				</p>
			{/if}
		</section>

		<hr class="rule" />

		<section class="insight">
			<h2>
				They keep saying<br /><em>the&nbsp;same&nbsp;thing.</em>
			</h2>
			<p class="lede">
				When buyers ask an LLM what to use, the same handful of names come back. Model Memory tracks
				that share-of-voice across every major model, and the rare moments it shifts.
			</p>

			<div class="stats">
				{#each insights as { stat, label } (stat + label)}
					<div class="stat">
						<div class="big">{stat}</div>
						<div class="tag">{label}</div>
					</div>
				{/each}
			</div>
		</section>

		<hr class="rule" />

		<section class="method">
			<h3>Method</h3>
			<ol>
				<li>
					<span class="num">i.</span>
					<div>
						<span class="step-title">We ask.</span>
						<span class="step-body"
							>Every major model. Identical prompts. Weekly cadence, plus on demand.</span
						>
					</div>
				</li>
				<li>
					<span class="num">ii.</span>
					<div>
						<span class="step-title">We archive.</span>
						<span class="step-body"
							>Every answer, time-stamped. Queryable, exportable, and citable as evidence.</span
						>
					</div>
				</li>
				<li>
					<span class="num">iii.</span>
					<div>
						<span class="step-title">You refresh.</span>
						<span class="step-body"
							>Commission a new query or refresh an existing one for a few cents in stablecoin via
							x402. We pay the model costs; the result enters the public archive.</span
						>
					</div>
				</li>
			</ol>
		</section>

		<section class="coming-soon">
			<p>Beta opening soon.</p>
			<p class="sig">— recommendation intelligence, made public</p>
		</section>
	</main>

	<footer class="colophon">
		<div>Model Memory &nbsp; · &nbsp; powered by Cloudflare</div>
		<div>Volume I established MMXXVI &nbsp; · &nbsp; Will Papper</div>
	</footer>
</div>

<style>
	.paper {
		max-width: 920px;
		margin: 0 auto;
		padding: clamp(1.5rem, 4vw, 3rem) clamp(1.25rem, 5vw, 4rem) 4rem;
		min-height: 100vh;
	}

	/* —— masthead —— */
	.masthead {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.9rem;
		border-bottom: 1px solid var(--color-ink);
		margin-bottom: clamp(3rem, 9vw, 6rem);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.masthead .mark {
		font-weight: 500;
	}

	.masthead .meta {
		color: var(--color-mark);
		text-decoration: none;
	}

	a.meta:hover {
		color: var(--color-stamp);
	}

	/* —— hero —— */
	.hero h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(3.2rem, 11vw, 7.5rem);
		line-height: 0.92;
		letter-spacing: -0.015em;
		margin: 0;
	}

	.hero h1 em {
		font-style: italic;
		color: var(--color-stamp);
	}

	.hero .subhead {
		font-family: var(--font-body);
		font-size: clamp(1.05rem, 1.5vw, 1.25rem);
		line-height: 1.55;
		font-weight: 400;
		max-width: 38ch;
		margin: clamp(1.5rem, 3vw, 2.4rem) 0 0;
		color: var(--color-ink);
	}

	/* —— rules —— */
	.rule {
		border: 0;
		border-top: 1px solid var(--color-rule);
		margin: clamp(3rem, 6vw, 5rem) 0;
	}

	/* —— specimen ledger —— */
	.specimen {
		position: relative;
	}

	.entry-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		margin-bottom: 1.5rem;
	}

	.entry-header .stamp {
		color: var(--color-stamp);
		border: 1px solid var(--color-stamp);
		padding: 0.25rem 0.55rem;
		display: inline-block;
		transform: rotate(-1.2deg);
	}

	.entry-header .logged {
		color: var(--color-mark);
	}

	.query {
		font-family: var(--font-display);
		font-size: clamp(1.7rem, 4vw, 2.6rem);
		line-height: 1.18;
		font-style: italic;
		margin: 0 0 2rem;
		max-width: 26ch;
	}

	.query .quote {
		color: var(--color-stamp);
		font-style: normal;
		font-weight: 400;
		margin: 0 0.05em;
	}

	.answers {
		list-style: none;
		padding: 0;
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.95rem;
	}

	.answers li {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		padding: 0.55rem 0;
		border-top: 1px dashed var(--color-rule);
		color: var(--color-ink);
	}

	.answers li:last-child {
		border-bottom: 1px dashed var(--color-rule);
	}

	.answers .model {
		flex: 0 0 auto;
		font-weight: 500;
	}

	.answers .dots {
		flex: 1 1 auto;
		border-bottom: 1px dotted var(--color-mark);
		transform: translateY(-0.25em);
	}

	.answers .answer {
		flex: 0 0 auto;
		text-align: right;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 1.05rem;
	}

	.answers li.diverges .answer {
		color: var(--color-stamp);
	}

	.answers li.diverges .answer::before {
		content: '※ ';
	}

	.consensus {
		margin: 1.5rem 0 0;
		font-family: var(--font-body);
		font-style: italic;
		color: var(--color-mark);
		font-size: 1rem;
	}

	.consensus a {
		color: var(--color-stamp);
		text-decoration: none;
	}

	.consensus a:hover {
		text-decoration: underline;
	}

	/* —— insight —— */
	.insight h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.5rem, 7vw, 4.5rem);
		line-height: 0.98;
		letter-spacing: -0.01em;
		margin: 0;
	}

	.insight h2 em {
		font-style: italic;
		color: var(--color-stamp);
	}

	.insight .lede {
		font-size: clamp(1.05rem, 1.4vw, 1.2rem);
		line-height: 1.55;
		max-width: 40ch;
		margin: 1.5rem 0 0;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1.5rem;
		margin-top: clamp(2rem, 4vw, 3rem);
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-rule);
	}

	.stat .big {
		font-family: var(--font-display);
		font-size: clamp(3rem, 6vw, 4.5rem);
		font-weight: 400;
		line-height: 1;
		color: var(--color-stamp);
	}

	.stat .tag {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-mark);
		margin-top: 0.5rem;
		max-width: 22ch;
		line-height: 1.4;
	}

	/* —— method —— */
	.method h3 {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		font-weight: 500;
		color: var(--color-mark);
		margin: 0 0 1.75rem;
	}

	.method ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 1.4rem;
	}

	.method li {
		display: grid;
		grid-template-columns: 3rem 1fr;
		gap: 1rem;
		align-items: baseline;
	}

	.method .num {
		font-family: var(--font-display);
		font-style: italic;
		font-size: 1.8rem;
		color: var(--color-stamp);
		line-height: 1;
	}

	.method .step-title {
		font-family: var(--font-display);
		font-size: 1.6rem;
		display: block;
		margin-bottom: 0.25rem;
	}

	.method .step-body {
		font-family: var(--font-body);
		font-size: 1.05rem;
		line-height: 1.55;
		color: var(--color-ink);
		max-width: 48ch;
	}

	/* —— coming soon —— */
	.coming-soon {
		margin-top: clamp(4rem, 8vw, 6rem);
		text-align: center;
	}

	.coming-soon p:first-child {
		font-family: var(--font-display);
		font-style: italic;
		font-size: clamp(1.6rem, 3.5vw, 2.2rem);
		margin: 0;
	}

	.coming-soon .sig {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-mark);
		margin-top: 0.75rem;
	}

	/* —— colophon —— */
	.colophon {
		margin-top: clamp(5rem, 10vw, 8rem);
		padding-top: 1rem;
		border-top: 1px solid var(--color-ink);
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-mark);
	}

	@media (max-width: 600px) {
		.answers li {
			flex-wrap: wrap;
		}
		.answers .dots {
			display: none;
		}
		.answers .answer {
			margin-left: auto;
		}
		.colophon {
			justify-content: flex-start;
			flex-direction: column;
			gap: 0.4rem;
		}
	}
</style>
