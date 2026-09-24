/**
 * What the board should show while Clerk, Convex and the runtime config settle.
 *
 * Clerk and Convex hold two separate sessions: Clerk can say "signed in" while
 * Convex is still waiting for, or has rejected, the token Clerk minted for it.
 * `canAccessApp` is resolved server-side from the Convex identity, so without
 * a Convex identity it is always false. Reading that as "your email is not
 * allowed" told allowed users they were unauthorized whenever the token
 * exchange was slow or failed (a skewed clock, an expired refresh, a blocked
 * request). A missing Convex identity is its own state, not a verdict.
 */

export type AccessGateState =
	| "loading"
	| "signedOut"
	| "sessionUnverified"
	| "forbidden"
	| "allowed";

export type AccessGateInput = {
	clerkLoaded: boolean;
	hasClerkUser: boolean;
	convexAuthLoading: boolean;
	convexAuthenticated: boolean;
	configReady: boolean;
	/** Whether the runtime config was computed with an identity. */
	configAuthenticated: boolean;
	canAccessApp: boolean;
	/** Board data, preferences and team access have all arrived. */
	dataReady: boolean;
};

export function resolveAccessGateState(
	input: AccessGateInput,
): AccessGateState {
	if (!input.clerkLoaded) return "loading";
	if (!input.hasClerkUser) return "signedOut";
	if (input.convexAuthLoading) return "loading";
	if (!input.convexAuthenticated) return "sessionUnverified";
	// The config subscription can still hold a result computed before the
	// socket was authenticated. Only a result that saw the identity may deny.
	if (!input.configReady || !input.configAuthenticated) return "loading";
	if (!input.canAccessApp) return "forbidden";
	if (!input.dataReady) return "loading";
	return "allowed";
}
