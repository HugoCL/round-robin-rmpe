import assert from "node:assert/strict";
import test from "node:test";
import {
	groupTeamsByMembership,
	pickLandingTeamSlug,
} from "../../lib/teamMembership";

const teams = [
	{ slug: "newest", name: "Newest" },
	{ slug: "payments", name: "Payments" },
	{ slug: "platform", name: "Platform" },
];

test("a person's own teams are listed apart from the rest, in the original order", () => {
	assert.deepEqual(groupTeamsByMembership(teams, ["platform", "payments"]), {
		mine: [teams[1], teams[2]],
		others: [teams[0]],
	});
});

test("someone on no team sees every team as someone else's", () => {
	assert.deepEqual(groupTeamsByMembership(teams, []), {
		mine: [],
		others: teams,
	});
});

test("landing goes back to the team the person last opened, even if it is not theirs", () => {
	assert.equal(
		pickLandingTeamSlug({
			teams,
			memberTeamSlugs: ["platform"],
			lastTeamSlug: "payments",
		}),
		"payments",
	);
});

test("without a last team, landing picks one of the person's own teams instead of the newest one", () => {
	assert.equal(
		pickLandingTeamSlug({
			teams,
			memberTeamSlugs: ["platform"],
			lastTeamSlug: null,
		}),
		"platform",
	);
});

test("a last team that no longer exists falls back to one of the person's own", () => {
	assert.equal(
		pickLandingTeamSlug({
			teams,
			memberTeamSlugs: ["payments"],
			lastTeamSlug: "deleted-team",
		}),
		"payments",
	);
});

test("someone on no team still lands on a team, and nowhere when there are none", () => {
	assert.equal(
		pickLandingTeamSlug({ teams, memberTeamSlugs: [], lastTeamSlug: null }),
		"newest",
	);
	assert.equal(
		pickLandingTeamSlug({ teams: [], memberTeamSlugs: [], lastTeamSlug: null }),
		null,
	);
});
