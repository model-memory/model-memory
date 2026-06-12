import { describe, expect, it } from 'vitest';
import {
	buildAuthorization,
	buildTypedData,
	chainId,
	encodePaymentHeader,
	randomNonce,
	type PaymentRequirements
} from './x402-client';

const req: PaymentRequirements = {
	scheme: 'exact',
	network: 'base-sepolia',
	maxAmountRequired: '200000',
	payTo: '0xRECEIVER',
	asset: '0xUSDC',
	maxTimeoutSeconds: 120,
	extra: { name: 'USDC', version: '2' }
};

describe('chainId', () => {
	it('maps known networks and rejects unknown ones', () => {
		expect(chainId('base')).toBe(8453);
		expect(chainId('base-sepolia')).toBe(84532);
		expect(() => chainId('mainnet')).toThrow('unsupported network');
	});
});

describe('randomNonce', () => {
	it('produces 0x-prefixed 32-byte hex', () => {
		expect(randomNonce(new Uint8Array(32))).toBe(`0x${'00'.repeat(32)}`);
		expect(randomNonce()).toMatch(/^0x[0-9a-f]{64}$/);
	});
});

describe('buildAuthorization', () => {
	it('quotes the exact amount with timeout headroom', () => {
		const auth = buildAuthorization(req, '0xME', 1_000_000_000_000, '0xnonce');
		expect(auth).toEqual({
			from: '0xME',
			to: '0xRECEIVER',
			value: '200000',
			validAfter: '0',
			validBefore: String(1_000_000_000 + 120 + 300),
			nonce: '0xnonce'
		});
	});
});

describe('buildTypedData', () => {
	it('builds the EIP-3009 domain from the challenge', () => {
		const auth = buildAuthorization(req, '0xME', 0, '0xnonce');
		const typed = buildTypedData(req, auth);
		expect(typed.primaryType).toBe('TransferWithAuthorization');
		expect(typed.domain).toEqual({
			name: 'USDC',
			version: '2',
			chainId: 84532,
			verifyingContract: '0xUSDC'
		});
		expect(typed.message).toBe(auth);
	});
});

describe('encodePaymentHeader', () => {
	it('round-trips through base64 as an x402 v1 exact payload', () => {
		const auth = buildAuthorization(req, '0xME', 0, '0xnonce');
		const header = encodePaymentHeader(req, auth, '0xsig');
		const decoded = JSON.parse(atob(header)) as {
			x402Version: number;
			scheme: string;
			network: string;
			payload: { signature: string; authorization: typeof auth };
		};
		expect(decoded.x402Version).toBe(1);
		expect(decoded.scheme).toBe('exact');
		expect(decoded.network).toBe('base-sepolia');
		expect(decoded.payload.signature).toBe('0xsig');
		expect(decoded.payload.authorization).toEqual(auth);
	});
});
