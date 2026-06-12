# Model Memory

An archive of which products LLMs recommend, tracked over time — market
research for the post-search era. This is the public face: a SvelteKit app on
Cloudflare Workers. The engine is the sibling
[`llm-gateway`](https://github.com/model-memory/llm-gateway) Worker, reached
via the `LLM_GATEWAY` service binding (RPC only — the gateway has no public
URL).

## How it fits together

- **`/`** — the front page. Renders the latest completed run's extracted
  recommendations as the specimen ledger; falls back to a printed mock until
  the archive has data.
- **`/archive`** — tracked questions (with funded-refresh balances and a
  per-question weekly toggle), recent runs, and an operator ask form.
- **`/archive/[runId]`** — one run: every model's answer, latency, the
  extracted product, and the consensus line.
- **`POST /api/commission`** — paid commissioning via
  [x402](https://www.x402.org). Without an `X-PAYMENT` header it returns a 402
  challenge; with one it verifies + settles through the facilitator, records
  the payment in the gateway, and (by default) spends one credit on an
  immediate refresh. `GET` the same path for pricing/discovery.

### Payments model

One payment buys N refresh credits. `allocation` scopes who can spend them:

| allocation | meaning                                   |
| ---------- | ----------------------------------------- |
| `single`   | buffer for one question                   |
| `subset`   | shared buffer across the listed questions |
| `all`      | shared pool every question can draw from  |

One credit is debited per refresh (most-specific buffer first). The weekly
cron in llm-gateway refreshes every weekly-enabled question that still has
buffer — so a buyer's remaining credits keep their question fresh.

Example with an x402-capable client:

```ts
import { wrapFetchWithPayment } from 'x402-fetch';

const fetchWithPay = wrapFetchWithPayment(fetch, walletClient);
await fetchWithPay('https://modelmemory.example/api/commission', {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify({
		prompt: 'Where should I host my SvelteKit app?',
		credits: 4, // 1 spent now, 3 left for weekly refreshes
		weekly: true
	})
});
```

x402 config lives in `wrangler.jsonc` `vars` (`X402_PAY_TO` empty disables the
endpoint; set it to your receiving address to go live).

## Developing

```sh
pnpm install
pnpm dev        # vite dev
pnpm check      # wrangler types + svelte-check
pnpm lint       # prettier + eslint
pnpm test:unit  # vitest
pnpm test:e2e   # playwright (builds + runs wrangler preview)
```

Without the llm-gateway Worker running locally, gateway-backed pages degrade
gracefully (the archive shows a "warming up" notice; the homepage uses the
printed specimen).

## Deploying

```sh
pnpm build
npx wrangler deploy
```

Deploy `llm-gateway` first (see its README for the one-time D1 + AI Gateway
setup) so the service binding resolves.
