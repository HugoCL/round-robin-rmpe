import assert from "node:assert/strict";
import test from "node:test";
import { buildCrossTeamReviewerPool } from "../../lib/crossTeamPool";

const platform = [{ _id: "r1", name: "Hugo" }];
const payments = [{ _id: "r2", name: "Martina" }];
const growth = [{ _id: "r3", name: "Diego" }];

test("mixes the requesting team with every requested team", () => {
	const pool = buildCrossTeamReviewerPool({
		sourceTeamSlug: "platform",
		sourceReviewers: platform,
		additionalTeams: [
			{ teamSlug: "payments", reviewers: payments },
			{ teamSlug: "growth", reviewers: growth },
		],
	});

	assert.deepEqual(
		pool.reviewers.map((reviewer) => reviewer.name),
		["Hugo", "Martina", "Diego"],
	);
	assert.equal(pool.teamSlugByReviewerId.get("r1"), "platform");
	assert.equal(pool.teamSlugByReviewerId.get("r2"), "payments");
	assert.equal(pool.teamSlugByReviewerId.get("r3"), "growth");
});

test("drops the requesting team's own members when teammates are excluded", () => {
	const pool = buildCrossTeamReviewerPool({
		sourceTeamSlug: "platform",
		sourceReviewers: platform,
		additionalTeams: [{ teamSlug: "payments", reviewers: payments }],
		excludeTeammates: true,
	});

	assert.deepEqual(
		pool.reviewers.map((reviewer) => reviewer.name),
		["Martina"],
	);
	assert.equal(pool.teamSlugByReviewerId.has("r1"), false);
});

test("keeps the requesting team when there is no other team to borrow from", () => {
	const pool = buildCrossTeamReviewerPool({
		sourceTeamSlug: "platform",
		sourceReviewers: platform,
		additionalTeams: [],
		excludeTeammates: true,
	});

	assert.deepEqual(
		pool.reviewers.map((reviewer) => reviewer.name),
		["Hugo"],
	);
});

test("lists a reviewer who belongs to two teams only once", () => {
	const shared = { _id: "r2", name: "Martina" };
	const pool = buildCrossTeamReviewerPool({
		sourceTeamSlug: "platform",
		sourceReviewers: platform,
		additionalTeams: [
			{ teamSlug: "payments", reviewers: [shared] },
			{ teamSlug: "growth", reviewers: [shared] },
		],
	});

	assert.equal(pool.reviewers.length, 2);
	assert.equal(pool.teamSlugByReviewerId.get("r2"), "payments");
});
