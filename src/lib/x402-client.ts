// Browser-side x402 payment client: signs a USDC EIP-3009
// TransferWithAuthorization with the user's injected wallet
// (eth_signTypedData_v4) and retries the request with the X-PAYMENT header.
// Pure builders are exported separately so they can be unit-tested.

export type PaymentRequirements = {
	scheme: string;
	network: string;
	maxAmountRequired: string;
	payTo: string;
	asset: string;
	maxTimeoutSeconds: number;
	extra?: { name?: string; version?: string };
};

export type Authorization = {
	from: string;
	to: string;
	value: string;
	validAfter: string;
	validBefore: string;
	nonce: string;
};

export const CHAIN_IDS: Record<string, number> = {
	base: 8453,
	'base-sepolia': 84532
};

export function chainId(network: string): number {
	const id = CHAIN_IDS[network];
	if (!id) throw new Error(`unsupported network: ${network}`);
	return id;
}

export function randomNonce(
	bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(32))
): string {
	return `0x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function buildAuthorization(
	req: PaymentRequirements,
	from: string,
	nowMs = Date.now(),
	nonce = randomNonce()
): Authorization {
	return {
		from,
		to: req.payTo,
		value: req.maxAmountRequired,
		validAfter: '0',
		// Leave headroom beyond the server's settle window.
		validBefore: String(Math.floor(nowMs / 1000) + req.maxTimeoutSeconds + 300),
		nonce
	};
}

// EIP-712 typed data for USDC's EIP-3009 transferWithAuthorization.
export function buildTypedData(req: PaymentRequirements, auth: Authorization) {
	return {
		types: {
			EIP712Domain: [
				{ name: 'name', type: 'string' },
				{ name: 'version', type: 'string' },
				{ name: 'chainId', type: 'uint256' },
				{ name: 'verifyingContract', type: 'address' }
			],
			TransferWithAuthorization: [
				{ name: 'from', type: 'address' },
				{ name: 'to', type: 'address' },
				{ name: 'value', type: 'uint256' },
				{ name: 'validAfter', type: 'uint256' },
				{ name: 'validBefore', type: 'uint256' },
				{ name: 'nonce', type: 'bytes32' }
			]
		},
		primaryType: 'TransferWithAuthorization' as const,
		domain: {
			name: req.extra?.name ?? 'USDC',
			version: req.extra?.version ?? '2',
			chainId: chainId(req.network),
			verifyingContract: req.asset
		},
		message: auth
	};
}

// The X-PAYMENT header: base64 JSON of the x402 v1 'exact' scheme payload.
export function encodePaymentHeader(
	req: PaymentRequirements,
	auth: Authorization,
	signature: string
): string {
	return btoa(
		JSON.stringify({
			x402Version: 1,
			scheme: req.scheme,
			network: req.network,
			payload: { signature, authorization: auth }
		})
	);
}

type Eip1193Provider = {
	request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function provider(): Eip1193Provider {
	const eth = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
	if (!eth) {
		throw new Error(
			'No browser wallet found — install one, or pay programmatically with an x402 client like x402-fetch.'
		);
	}
	return eth;
}

export type CommissionOutcome = {
	status: number;
	body: unknown;
	payer: string;
};

// Full browser flow: POST -> 402 challenge -> wallet signature -> paid POST.
export async function payCommission(endpoint: string, body: unknown): Promise<CommissionOutcome> {
	const first = await fetch(endpoint, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (first.status !== 402) {
		return { status: first.status, body: await first.json(), payer: '' };
	}

	const challenge = (await first.json()) as { accepts?: PaymentRequirements[]; error?: string };
	const req = challenge.accepts?.[0];
	if (!req) throw new Error(challenge.error ?? 'malformed 402 challenge');

	const eth = provider();
	const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
	const from = accounts[0];
	if (!from) throw new Error('wallet returned no account');

	const auth = buildAuthorization(req, from);
	const typedData = buildTypedData(req, auth);
	const signature = (await eth.request({
		method: 'eth_signTypedData_v4',
		params: [from, JSON.stringify(typedData)]
	})) as string;

	const paid = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'X-PAYMENT': encodePaymentHeader(req, auth, signature)
		},
		body: JSON.stringify(body)
	});
	return { status: paid.status, body: await paid.json(), payer: from };
}
