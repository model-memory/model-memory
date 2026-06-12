// Shared display formatting (previously copy-pasted per page).

const pad = (n: number) => String(n).padStart(2, '0');

/** 2026.06.12 */
export function stampDate(unixSeconds: number): string {
	const d = new Date(unixSeconds * 1000);
	return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}

/** 2026.06.12 · 14:21 UTC */
export function stampDateTime(unixSeconds: number): string {
	const d = new Date(unixSeconds * 1000);
	return `${stampDate(unixSeconds)} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** 0x1234…abcd */
export function shortAddress(address: string): string {
	return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
