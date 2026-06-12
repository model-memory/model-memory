<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	const balanceByQuestion = $derived(
		new Map(data.balances.questions.map((b) => [b.question_id, b.available_credits]))
	);
	const questionById = $derived(new Map(data.questions.map((q) => [q.id, q])));

	function stamp(unixSeconds: number): string {
		const d = new Date(unixSeconds * 1000);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
	}
</script>

<svelte:head>
	<title>The Archive — Model Memory</title>
	<meta name="description" content="Every query, every model, every answer — time-stamped." />
</svelte:head>

<div class="paper">
	<header class="masthead">
		<a class="mark" href={resolve('/')}>Model Memory</a>
		<div class="meta">The Archive</div>
	</header>

	<main class="page">
		{#if !data.available}
			<p class="notice">
				The archive is warming up — the gateway is not reachable from this deployment yet.
			</p>
		{:else}
			<section>
				<h2 class="section-title">Tracked questions</h2>
				{#if data.questions.length === 0}
					<p class="notice">No questions tracked yet. Ask one below.</p>
				{:else}
					<ul class="ledger">
						{#each data.questions as q (q.id)}
							{@const credits = (balanceByQuestion.get(q.id) ?? 0) + data.balances.global_credits}
							<li>
								<span class="q-text">{q.text}</span>
								<span class="q-meta">
									<span class="credits" class:unfunded={credits === 0}>
										{credits} refresh{credits === 1 ? '' : 'es'} funded
									</span>
									<form method="POST" action="?/weekly">
										<input type="hidden" name="questionId" value={q.id} />
										<input type="hidden" name="weekly" value={q.weekly ? 'false' : 'true'} />
										<button class="toggle" type="submit">
											weekly: {q.weekly ? 'on' : 'off'}
										</button>
									</form>
								</span>
							</li>
						{/each}
					</ul>
					<p class="footnote">
						Shared pool: {data.balances.global_credits} credit{data.balances.global_credits === 1
							? ''
							: 's'} usable by every question. Commission refreshes or new queries for a few cents via
						<code>POST /api/commission</code> (x402).
					</p>
				{/if}
			</section>

			<hr class="rule" />

			<section>
				<h2 class="section-title">Recent runs</h2>
				{#if data.runs.length === 0}
					<p class="notice">No runs yet.</p>
				{:else}
					<ul class="ledger">
						{#each data.runs as run (run.id)}
							<li>
								<a class="q-text" href={resolve('/archive/[runId]', { runId: run.id })}
									>{run.prompt}</a
								>
								<span class="q-meta">
									{#if run.question_id && questionById.get(run.question_id)}
										<span class="tag">tracked</span>
									{/if}
									<span class="tag" class:running={run.status === 'running'}>{run.status}</span>
									<span class="logged">{stamp(run.created_at)}</span>
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<hr class="rule" />

			<section>
				<h2 class="section-title">Ask the machines</h2>
				{#if form?.message}
					<p class="notice error">{form.message}</p>
				{/if}
				<form class="ask" method="POST" action="?/ask">
					<input
						name="prompt"
						type="text"
						placeholder="e.g. Where should I host my SvelteKit app?"
						required
					/>
					<button type="submit">Run it</button>
				</form>
			</section>
		{/if}
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

	.masthead .mark {
		font-weight: 500;
		text-decoration: none;
		color: inherit;
	}

	.masthead .meta {
		color: var(--color-mark);
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
		gap: 0.5rem 1rem;
		padding: 0.6rem 0;
		border-top: 1px dashed var(--color-rule);
	}

	.ledger li:last-child {
		border-bottom: 1px dashed var(--color-rule);
	}

	.q-text {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 1.05rem;
		color: var(--color-ink);
		text-decoration: none;
	}

	a.q-text:hover {
		color: var(--color-stamp);
	}

	.q-meta {
		display: flex;
		align-items: baseline;
		gap: 0.9rem;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.credits {
		color: var(--color-ink);
	}

	.credits.unfunded {
		color: var(--color-mark);
	}

	.tag {
		border: 1px solid var(--color-rule);
		padding: 0.1rem 0.4rem;
		color: var(--color-mark);
	}

	.tag.running {
		border-color: var(--color-stamp);
		color: var(--color-stamp);
	}

	.logged {
		color: var(--color-mark);
	}

	.toggle {
		background: none;
		border: 1px solid var(--color-rule);
		padding: 0.1rem 0.4rem;
		font: inherit;
		color: var(--color-mark);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.toggle:hover {
		border-color: var(--color-stamp);
		color: var(--color-stamp);
	}

	.notice {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--color-mark);
	}

	.notice.error {
		color: var(--color-stamp);
	}

	.footnote {
		margin-top: 1rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		color: var(--color-mark);
	}

	.footnote code {
		color: var(--color-ink);
	}

	.ask {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.ask input[type='text'] {
		flex: 1 1 20rem;
		background: transparent;
		border: 1px solid var(--color-rule);
		font-family: var(--font-body);
		font-size: 1.05rem;
		padding: 0.55rem 0.8rem;
		color: var(--color-ink);
	}

	.ask input[type='text']:focus {
		border-color: var(--color-stamp);
		outline: none;
	}

	.ask button {
		background: var(--color-ink);
		color: var(--color-paper);
		border: 0;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		padding: 0.55rem 1.2rem;
		cursor: pointer;
	}

	.ask button:hover {
		background: var(--color-stamp);
	}
</style>
