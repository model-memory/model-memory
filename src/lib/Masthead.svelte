<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const sections = [
		{ label: 'The Archive', href: resolve('/archive'), match: '/archive' },
		{ label: 'The Shifts', href: resolve('/shifts'), match: '/shifts' },
		{ label: 'Commission', href: resolve('/commission'), match: '/commission' }
	];

	const path = $derived(page.url.pathname);
</script>

<header class="masthead">
	<a class="mark" href={resolve('/')}>Model Memory</a>
	<nav class="nav">
		{#each sections as s (s.href)}
			<a href={s.href} class:current={path.startsWith(s.match)}>{s.label}</a>
		{/each}
	</nav>
</header>

<style>
	.masthead {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		padding-bottom: 0.9rem;
		border-bottom: 1px solid var(--color-ink);
		margin-bottom: clamp(2rem, 6vw, 4rem);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.mark {
		font-weight: 500;
		text-decoration: none;
		color: inherit;
	}

	.mark:hover {
		color: var(--color-stamp);
	}

	.nav {
		display: flex;
		gap: 1.25rem;
	}

	.nav a {
		color: var(--color-mark);
		text-decoration: none;
	}

	.nav a:hover {
		color: var(--color-stamp);
	}

	.nav a.current {
		color: var(--color-stamp);
	}
</style>
