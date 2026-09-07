import assert from "node:assert/strict";
import test from "node:test";
import {
	canAdministerTeam,
	isTeamOwner,
	pickTeamOwnerCandidate,
	resolveReviewerRole,
	teamHasOwner,
	teamRetainsOwner,
} from "../../lib/teamRoles";

function reviewer(
	id: string,
	email: string,
	createdAt: number,
	creationTime = createdAt,
) {
	return { _id: id, email, createdAt, _creationTime: creationTime };
}

test("a row written before roles existed reads as a member, never undefined", () => {
	assert.equal(resolveReviewerRole({}), "member");
	assert.equal(resolveReviewerRole({ role: undefined }), "member");
	assert.equal(resolveReviewerRole({ role: "member" }), "member");
	assert.equal(resolveReviewerRole({ role: "owner" }), "owner");
	assert.equal(isTeamOwner({}), false);
	assert.equal(isTeamOwner({ role: "owner" }), true);
});

test("the oldest reviewer becomes the owner", () => {
	const pick = pickTeamOwnerCandidate([
		reviewer("b", "b@acme.com", 200),
		reviewer("a", "a@acme.com", 100),
		reviewer("c", "c@acme.com", 300),
	]);
	assert.equal(pick.owner?._id, "a");
	assert.equal(pick.tiedCount, 1);
	assert.equal(pick.filteredSeedRows, false);
});

test("demo seed rows are set aside so a real person gets the team", () => {
	// initializeData inserts Juan/Pedro @example.com with a 2021 timestamp,
	// which is older than a team created later by a real person.
	const pick = pickTeamOwnerCandidate([
		reviewer("juan", "juan@example.com", 1614556800000),
		reviewer("pedro", "pedro@example.com", 1614556800001),
		reviewer("real", "lead@acme.com", 1700000000000),
	]);
	assert.equal(pick.owner?._id, "real");
	assert.equal(pick.filteredSeedRows, true);
});

test("a team of only demo rows still gets an owner rather than none", () => {
	const pick = pickTeamOwnerCandidate([
		reviewer("juan", "juan@example.com", 200),
		reviewer("pedro", "pedro@example.com", 100),
	]);
	assert.equal(pick.owner?._id, "pedro");
	assert.equal(pick.filteredSeedRows, false);
});

test("an imported roster tied on createdAt is broken by _creationTime", () => {
	// importReviewersData reinserts every row with Date.now() when the payload
	// carries no createdAt, so all of them share one millisecond.
	const pick = pickTeamOwnerCandidate([
		reviewer("x", "x@acme.com", 500, 903),
		reviewer("y", "y@acme.com", 500, 901),
		reviewer("z", "z@acme.com", 500, 902),
	]);
	assert.equal(pick.owner?._id, "y");
	assert.equal(pick.tiedCount, 3);
});

test("an empty team reports no owner instead of throwing", () => {
	const pick = pickTeamOwnerCandidate([]);
	assert.equal(pick.owner, null);
	assert.equal(pick.tiedCount, 0);
});

test("teamRetainsOwner protects the last owner from removal and demotion", () => {
	const roster = [
		{ _id: "o", role: "owner" as const },
		{ _id: "m", role: "member" as const },
		{ _id: "legacy" },
	];
	assert.equal(teamRetainsOwner(roster), true);
	assert.equal(teamRetainsOwner(roster, { excluding: "m" }), true);
	assert.equal(teamRetainsOwner(roster, { excluding: "o" }), false);
	assert.equal(teamRetainsOwner(roster, { demoting: "o" }), false);

	// Two owners: losing one is fine.
	const twoOwners = [
		{ _id: "o1", role: "owner" as const },
		{ _id: "o2", role: "owner" as const },
	];
	assert.equal(teamRetainsOwner(twoOwners, { excluding: "o1" }), true);

	// A roster of legacy rows has no owner at all, which the backfill fixes.
	assert.equal(teamRetainsOwner([{ _id: "legacy" }]), false);
});

test("teamHasOwner treats a pre-migration roster as ownerless", () => {
	assert.equal(teamHasOwner([{}, {}]), false);
	assert.equal(teamHasOwner([{}, { role: "owner" as const }]), true);
	assert.equal(teamHasOwner([]), false);
});

test("the owner gate stands down only while a team has no owner", () => {
	// An owner always passes.
	assert.equal(canAdministerTeam({ isOwner: true, teamHasOwner: true }), true);

	// A member is refused once the team has an owner to ask.
	assert.equal(
		canAdministerTeam({ isOwner: false, teamHasOwner: true }),
		false,
	);

	// Pre-backfill: the whole team is ownerless, so members keep the access
	// they had before roles existed. This is what lets the gate ship with the
	// field instead of a deploy later.
	assert.equal(
		canAdministerTeam({ isOwner: false, teamHasOwner: false }),
		true,
	);
});
