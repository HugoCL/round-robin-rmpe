const TOKEN_PREFIX = "lla_";

function toHex(bytes: ArrayBuffer) {
	return Array.from(new Uint8Array(bytes))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function randomSegment() {
	return crypto.randomUUID().replaceAll("-", "");
}

export function createAgentTokenValue() {
	return `${TOKEN_PREFIX}${randomSegment()}${randomSegment()}`;
}

export function getAgentTokenPrefix(token: string) {
	return token.slice(0, 12);
}

export async function hashAgentToken(token: string) {
	const data = new TextEncoder().encode(token);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return toHex(digest);
}
