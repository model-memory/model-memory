import { describe, expect, it } from 'vitest';
import { challenge, paymentRequirements, x402Config, type X402Config } from './x402';

const cfg: X402Config = {
	payTo: '0xabc',
	network: 'base-sepolia',
	facilitatorUrl: 'https://x402.org/facilitator',
	asset: '0xusdc',
	creditPriceUsdcMicro: 50000
};

describe('x402Config', () => {
	it('is disabled until a payTo address is configured', () => {
		expect(x402Config({ X402_PAY_TO: '' } as unknown as Env)).toBeNull();
		expect(x402Config({ X402_PAY_TO: '   ' } as unknown as Env)).toBeNull();
	});
});

describe('paymentRequirements', () => {
	it('quotes the amount in atomic units against the configured asset', () => {
		const req = paymentRequirements(cfg, 'https://example.com/api/commission', 150000, '3 credits');
		expect(req.scheme).toBe('exact');
		expect(req.maxAmountRequired).toBe('150000');
		expect(req.payTo).toBe('0xabc');
		expect(req.asset).toBe('0xusdc');
		expect(req.network).toBe('base-sepolia');
	});
});

describe('challenge', () => {
	it('returns a 402 with an x402 v1 body', async () => {
		const req = paymentRequirements(cfg, 'https://example.com/api/commission', 50000, '1 credit');
		const res = challenge(req, 'Payment required');
		expect(res.status).toBe(402);
		const body = (await res.json()) as { x402Version: number; accepts: unknown[] };
		expect(body.x402Version).toBe(1);
		expect(body.accepts).toHaveLength(1);
	});
});
