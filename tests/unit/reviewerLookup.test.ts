import assert from "node:assert/strict";
import test from "node:test";
import { identityDisplayName } from "../../convex/reviewerLookup";

test("uses the Clerk full name when it is present", () => {
	assert.equal(
		identityDisplayName({
			name: "Hugo Castro",
			givenName: "Hugo",
			familyName: "Castro",
		}),
		"Hugo Castro",
	);
});

test("joins given and family names when the full name is missing", () => {
	assert.equal(
		identityDisplayName({
			givenName: "Rosario",
			familyName: "Ferrer Donoso",
		}),
		"Rosario Ferrer Donoso",
	);
});

test("returns undefined when Clerk has no usable name", () => {
	assert.equal(identityDisplayName(undefined), undefined);
	assert.equal(identityDisplayName({ name: "   " }), undefined);
});
