import assert from "node:assert/strict";
import test from "node:test";
import {
	type AccessGateInput,
	resolveAccessGateState,
} from "../../lib/accessGate";

const SETTLED: AccessGateInput = {
	clerkLoaded: true,
	hasClerkUser: true,
	convexAuthLoading: false,
	convexAuthenticated: true,
	configReady: true,
	configAuthenticated: true,
	canAccessApp: true,
	dataReady: true,
};

test("a settled, allowed user reaches the board", () => {
	assert.equal(resolveAccessGateState(SETTLED), "allowed");
});

test("signed out of Clerk is not a denial", () => {
	assert.equal(
		resolveAccessGateState({ ...SETTLED, hasClerkUser: false }),
		"signedOut",
	);
	assert.equal(
		resolveAccessGateState({ ...SETTLED, clerkLoaded: false }),
		"loading",
	);
});

test("a Clerk session that Convex has not accepted is never reported as forbidden", () => {
	// The regression: config without an identity always says canAccessApp=false.
	const noIdentity = {
		...SETTLED,
		configAuthenticated: false,
		canAccessApp: false,
	};
	assert.equal(
		resolveAccessGateState({ ...noIdentity, convexAuthLoading: true }),
		"loading",
	);
	assert.equal(
		resolveAccessGateState({ ...noIdentity, convexAuthenticated: false }),
		"sessionUnverified",
	);
	// Socket authenticated, config still holding the pre-auth result.
	assert.equal(resolveAccessGateState(noIdentity), "loading");
});

test("only a config computed with an identity can deny", () => {
	assert.equal(
		resolveAccessGateState({ ...SETTLED, canAccessApp: false }),
		"forbidden",
	);
});

test("a denied user sees the denial without waiting on board data", () => {
	assert.equal(
		resolveAccessGateState({
			...SETTLED,
			canAccessApp: false,
			dataReady: false,
		}),
		"forbidden",
	);
	assert.equal(
		resolveAccessGateState({ ...SETTLED, dataReady: false }),
		"loading",
	);
});
