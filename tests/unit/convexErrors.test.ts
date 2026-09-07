import assert from "node:assert/strict";
import test from "node:test";
import {
	classifyConvexError,
	extractConvexMessage,
} from "../../lib/convexErrors";

const CONVEX_WRAPPED = new Error(
	"[CONVEX M(teamRoles:setReviewerRole)] [Request ID: 858] Server Error\nUncaught Error: Team must keep at least one owner\n    at assertTeamRetainsOwner (../../convex/authz.ts:225:0)\n    at async handler",
);

test("classifies the authorization sentinels through Convex framing", () => {
	assert.equal(classifyConvexError(CONVEX_WRAPPED), "lastOwner");
	assert.equal(
		classifyConvexError(new Error("Uncaught Error: TeamOwnerRequired")),
		"teamOwnerRequired",
	);
	assert.equal(
		classifyConvexError(new Error("Uncaught Error: FeatureDisabled: events")),
		"featureDisabled",
	);
	assert.equal(
		classifyConvexError(new Error("Uncaught Error: Unauthorized")),
		"unauthorized",
	);
	assert.equal(classifyConvexError(new Error("something else")), null);
	assert.equal(classifyConvexError(undefined), null);
});

test("the more specific sentinel wins over the generic one", () => {
	// "TeamOwnerRequired" must not be reported as a plain Unauthorized.
	assert.equal(
		classifyConvexError(
			new Error("Uncaught Error: TeamOwnerRequired\nUnauthorized"),
		),
		"teamOwnerRequired",
	);
});

test("extracts a written validation message and refuses to surface a stack trace", () => {
	assert.equal(
		extractConvexMessage(
			new Error(
				"[CONVEX M(x)] Server Error\nUncaught Error: Domain mode needs at least one valid domain",
			),
		),
		"Domain mode needs at least one valid domain",
	);
	// A bare Convex envelope has nothing worth showing.
	assert.equal(
		extractConvexMessage(
			new Error("[CONVEX Q(y)] [Request ID: 1] Server Error"),
		),
		undefined,
	);
	assert.equal(extractConvexMessage("not an error"), undefined);
});
