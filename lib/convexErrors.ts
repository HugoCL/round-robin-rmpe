/**
 * Turns a Convex error into something a person can act on.
 *
 * Convex wraps a thrown message in request ids and a stack trace, so showing
 * `error.message` verbatim puts "Uncaught Error: ... at handler (...)" in a
 * toast. The authorization sentinels are matched here so the UI can explain
 * what to do instead.
 */

export type KnownErrorCode =
	| "teamOwnerRequired"
	| "lastOwner"
	| "featureDisabled"
	| "unauthorized";

const SENTINELS: Array<{ code: KnownErrorCode; needle: string }> = [
	{ code: "teamOwnerRequired", needle: "TeamOwnerRequired" },
	{ code: "lastOwner", needle: "Team must keep at least one owner" },
	{ code: "featureDisabled", needle: "FeatureDisabled" },
	{ code: "unauthorized", needle: "Unauthorized" },
];

export function classifyConvexError(error: unknown): KnownErrorCode | null {
	const message = error instanceof Error ? error.message : String(error ?? "");
	for (const { code, needle } of SENTINELS) {
		if (message.includes(needle)) return code;
	}
	return null;
}

/**
 * The message to show when the error is not one we recognise.
 *
 * Strips Convex's framing so a validation message written in a mutation still
 * reads as a sentence, and gives up rather than showing a stack trace.
 */
export function extractConvexMessage(error: unknown): string | undefined {
	if (!(error instanceof Error)) return undefined;
	const match = error.message.match(/Uncaught Error:\s*([^\n]+)/);
	const raw = (match?.[1] ?? error.message).trim();
	if (!raw || raw.includes("    at ") || raw.startsWith("[CONVEX")) {
		return undefined;
	}
	return raw;
}
