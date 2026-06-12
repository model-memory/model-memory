<script lang="ts">
	import { resolve } from '$app/paths';
	import { productKey, tallyProducts } from '$lib/products';

	let { data } = $props();

	const question = $derived(data.history.question);

	// Overall share of voice: every named pick across every archived run.
	const share = $derived.by(() => {
		const all = data.history.runs.flatMap((r) => r.picks.map((p) => p.recommended_product));
		const tally = tallyProducts(all);
		const total = tally.reduce((sum, t) => sum + t.count, 0);
		return { tally: tally.slice(0, 6), total };
	});

	// Per-run consensus rows, newest first.
	const timeline = $derived(
		data.history.runs.map(({ run, picks }) => {
			const named = picks.filter((p) => p.recommended_product);
			const tally = tallyProducts(named.map((p) => p.recommended_product));
			const top = tally[0] ?? null;
			const dissenters = top
				? named
						.filter((p) => productKey(p.recommended_product as string) !== productKey(top.name))
						.map((p) => p.model)
				: [];
			return { run, top, named: named.length, dissenters };
		})
	);

	function stamp(unixSeconds: number): string {
		const d = new Date(unixSeconds * 1000);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
	}

	function short(address: string): string {
		return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
	}
</script>

<svelte:head>
	<title>{question.text} — Model Memory</title>
</svelte:head>

<div class="paper">
	<header class="masthead">
		<a class="mark" href={resolve('/')}>Model Memory</a>
		<a class="meta" href={resolve('/archive')}>← The Archive</a>
	</header>

	<main class="page">
		<section>
			<div class="entry-header">
				<span class="stamp">Tracked question</span>
				<span class="logged">since {stamp(question.created_at)}</span>
			</div>

			<p class="query">
				<span class="quote">&ldquo;</span>{question.text}<span class="quote">&rdquo;</span>
			</p>

			<p class="status-line">
				<span class="tag" class:on={question.weekly === 1}
					>weekly: {question.weekly ? 'on' : 'off'}</span
				>
				<span class="tag" class:on={data.credits > 0}>
					{data.credits} refresh{data.credits === 1 ? '' : 'es'} funded
				</span>
				{#if data.history.funders.length > 0}
					<span class="funders">
						funded by
						{#each data.history.funders as funder, i (funder)}
							<code>{short(funder)}</code>{i < data.history.funders.length - 1 ? ', ' : ''}
						{/each}
					</span>
				{/if}
			</p>
		</section>

		<hr class="rule" />

		<section>
			<h2 class="section-title">Share of voice</h2>
			{#if share.total === 0}
				<p class="notice">No extracted recommendations yet.</p>
			{:else}
				<ul class="share">
					{#each share.tally as { name, count } (name)}
						<li>
							<span class="share-name">{name}</span>
							<span class="bar" aria-hidden="true">
								<span class="fill" style={`width: ${Math.round((count / share.total) * 100)}%`}
								></span>
							</span>
							<span class="share-pct">{Math.round((count / share.total) * 100)}%</span>
						</li>
					{/each}
				</ul>
				<p class="footnote">
					{share.total} named recommendation{share.total === 1 ? '' : 's'} across {data.history.runs
						.length} run{data.history.runs.length === 1 ? '' : 's'}.
				</p>
			{/if}
		</section>

		<hr class="rule" />

		<section>
			<h2 class="section-title">Timeline</h2>
			{#if timeline.length === 0}
				<p class="notice">No runs archived for this question yet.</p>
			{:else}
				<ul class="ledger">
					{#each timeline as { run, top, named, dissenters } (run.id)}
						<li>
							<a class="row-main" href={resolve('/archive/[runId]', { runId: run.id })}>
								<span class="logged">{stamp(run.created_at)}</span>
								{#if top}
									<span class="pick">{top.name}</span>
									<span class="count">{top.count}&thinsp;⁄&thinsp;{named}</span>
								{:else}
									<span class="pick muted">
										{run.status === 'running' ? 'in progress' : 'no clear pick'}
									</span>
								{/if}
							</a>
							{#if dissenters.length > 0}
								<span class="dissent">dissent: {dissenters.join(', ')}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>

<style>
	.paper {
		max-width: 920px;
		margin: 0 auto;
		padding: clamp(1.5rem, 4vw, 3rem) clamp(1.25rem, 5vw, 4rem) 4rem;
		min-height: 100vh;
	}

	.masthead {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.9rem;
		border-bottom: 1px solid var(--color-ink);
		margin-bottom: clamp(2rem, 6vw, 4rem);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.masthead a {
		text-decoration: none;
		color: inherit;
	}

	.masthead .mark {
		font-weight: 500;
	}

	.masthead .meta {
		color: var(--color-mark);
	}

	.masthead .meta:hover {
		color: var(--color-stamp);
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
		margin: 0 0 1.25rem;
		max-width: 30ch;
	}

	.query .quote {
		color: var(--color-stamp);
		font-style: normal;
		margin: 0 0.05em;
	}

	.status-line {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.9rem;
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-mark);
	}

	.tag {
		border: 1px solid var(--color-rule);
		padding: 0.1rem 0.4rem;
	}

	.tag.on {
		border-color: var(--color-stamp);
		color: var(--color-stamp);
	}

	.funders code {
		text-transform: none;
		color: var(--color-ink);
	}

	.section-title {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		font-weight: 500;
		color: var(--color-mark);
		margin: 0 0 1.25rem;
	}

	.rule {
		border: 0;
		border-top: 1px solid var(--color-rule);
		margin: clamp(2rem, 5vw, 3.5rem) 0;
	}

	.share {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}

	.share li {
		display: grid;
		grid-template-columns: minmax(8rem, 14rem) 1fr 3rem;
		align-items: center;
		gap: 1rem;
	}

	.share-name {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 1.05rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bar {
		height: 0.55rem;
		border: 1px solid var(--color-rule);
		display: block;
	}

	.fill {
		display: block;
		height: 100%;
		background: var(--color-stamp);
		opacity: 0.75;
	}

	.share-pct {
		text-align: right;
		color: var(--color-mark);
	}

	.ledger {
		list-style: none;
		padding: 0;
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	.ledger li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
		padding: 0.6rem 0;
		border-top: 1px dashed var(--color-rule);
	}

	.ledger li:last-child {
		border-bottom: 1px dashed var(--color-rule);
	}

	.row-main {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		text-decoration: none;
		color: inherit;
	}

	.row-main:hover .pick {
		color: var(--color-stamp);
	}

	.logged {
		color: var(--color-mark);
	}

	.pick {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 1.05rem;
	}

	.pick.muted {
		color: var(--color-mark);
	}

	.count {
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		color: var(--color-mark);
	}

	.dissent {
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-stamp);
	}

	.notice {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--color-mark);
	}

	.footnote {
		margin-top: 1rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		color: var(--color-mark);
	}
</style>
