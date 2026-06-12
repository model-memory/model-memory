// Minimal x402 resource-server helper (protocol v1 wire format, as spoken by
// x402-fetch clients and the x402.org facilitator). Kept dependency-free and
// isolated here so it can be swapped for the official @x402/* packages later.

export type X402Config = {
	payTo: string;
	network: string;
	facilitatorUrl: string;
	asset: string;
	creditPriceUsdcMicro: number;
};

export type PaymentRequirements = {
	scheme: 'exact';
	network: string;
	maxAmountRequired: string; // atomic units (USDC has 6 decimals)
	resource: string;
	description: string;
	mimeType: string;
	payTo: string;
	maxTimeoutSeconds: number;
	asset: string;
	extra: { name: string; version: string };
};

export type Settlement = {
	payer: string | null;
	transaction: string | null;
	network: string;
	/** base64 payload for the X-PAYMENT-RESPONSE header */
	responseHeader: string;
};

export type SettleOutcome =
	| { ok: true; settlement: Settlement }
	| { ok: false; status: number; error: string };

export function x402Config(env: Env): X402Config | null {
	const payTo = String(env.X402_PAY_TO ?? '').trim();
	if (!payTo) return null;
	return {
		payTo,
		network: String(env.X402_NETWORK),
		facilitatorUrl: String(env.X402_FACILITATOR_URL).replace(/\/$/, ''),
		asset: String(env.X402_ASSET),
		creditPriceUsdcMicro: Number(env.X402_CREDIT_PRICE_USDC_MICRO) || 50000
	};
}

export function paymentRequirements(
	cfg: X402Config,
	resource: string,
	amountUsdcMicro: number,
	description: string
): PaymentRequirements {
	return {
		scheme: 'exact',
		network: cfg.network,
		maxAmountRequired: String(amountUsdcMicro),
		resource,
		description,
		mimeType: 'application/json',
		payTo: cfg.payTo,
		maxTimeoutSeconds: 120,
		asset: cfg.asset,
		extra: { name: 'USDC', version: '2' }
	};
}

export function challenge(requirements: PaymentRequirements, error = 'Payment required'): Response {
	return Response.json({ x402Version: 1, error, accepts: [requirements] }, { status: 402 });
}

// Verify the X-PAYMENT header with the facilitator, then settle on-chain.
export async function verifyAndSettle(
	cfg: X402Config,
	request: Request,
	requirements: PaymentRequirements
): Promise<SettleOutcome> {
	const header = request.headers.get('X-PAYMENT');
	if (!header) {
		return { ok: false, status: 402, error: 'Payment required' };
	}

	let paymentPayload: unknown;
	try {
		paymentPayload = JSON.parse(atob(header));
	} catch {
		return { ok: false, status: 400, error: 'Malformed X-PAYMENT header' };
	}

	const body = JSON.stringify({
		x402Version: 1,
		paymentPayload,
		paymentRequirements: requirements
	});

	const verifyRes = await fetch(`${cfg.facilitatorUrl}/verify`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body
	});
	if (!verifyRes.ok) {
		return { ok: false, status: 502, error: `facilitator verify failed (${verifyRes.status})` };
	}
	const verify = (await verifyRes.json()) as { isValid?: boolean; invalidReason?: string };
	if (!verify.isValid) {
		return { ok: false, status: 402, error: verify.invalidReason ?? 'Payment invalid' };
	}

	const settleRes = await fetch(`${cfg.facilitatorUrl}/settle`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body
	});
	if (!settleRes.ok) {
		return { ok: false, status: 502, error: `facilitator settle failed (${settleRes.status})` };
	}
	const settle = (await settleRes.json()) as {
		success?: boolean;
		errorReason?: string;
		transaction?: string;
		network?: string;
		payer?: string;
	};
	if (!settle.success) {
		return { ok: false, status: 402, error: settle.errorReason ?? 'Payment settlement failed' };
	}

	return {
		ok: true,
		settlement: {
			payer: settle.payer ?? null,
			transaction: settle.transaction ?? null,
			network: settle.network ?? cfg.network,
			responseHeader: btoa(JSON.stringify(settle))
		}
	};
}
