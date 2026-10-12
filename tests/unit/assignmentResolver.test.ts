import assert from "node:assert/strict";
import test from "node:test";
import {
	type AssignmentResolverReviewer,
	countRegularAssignmentsUntilReviewer,
	isForcedAssignmentStrategy,
	isSingleForcedAssignment,
	resolveAssignmentSlots,
	resolveAssignmentSlotsPerTeam,
} from "../../lib/assignmentResolver";

type Reviewer = AssignmentResolverReviewer<string, string>;

const reviewer = (
	id: string,
	assignmentCount: number,
	createdAt: number,
	overrides: Partial<Reviewer> = {},
): Reviewer => ({
	_id: id,
	name: id,
	assignmentCount,
	createdAt,
	effectiveIsAbsent: false,
	tags: [],
	...overrides,
});

test("selects fairly while excluding absent, duplicate, and current reviewers", () => {
	const result = resolveAssignmentSlots({
		mode: "regular",
		slots: [{ strategy: "random" }, { strategy: "random" }],
		reviewers: [
			reviewer("current", 0, 1),
			reviewer("absent", 0, 2, { effectiveIsAbsent: true }),
			reviewer("general-pool-excluded", 0, 3, {
				excludedFromReviewPool: true,
				includedInTagRotations: true,
			}),
			reviewer("next", 0, 4),
			reviewer("after", 1, 5),
		],
		excludedReviewerId: "current",
	});

	assert.deepEqual(
		result.resolved.map(({ reviewer: selected }) => selected._id),
		["next", "after"],
	);
	assert.deepEqual(result.failed, []);
});

test("marks an explicitly chosen reviewer as a forced assignment", () => {
	const result = resolveAssignmentSlots({
		mode: "regular",
		slots: [
			{ strategy: "specific", reviewerId: "hugo" },
			{ strategy: "random" },
		],
		reviewers: [reviewer("hugo", 0, 1), reviewer("ana", 0, 2)],
	});

	assert.deepEqual(
		result.resolved.map((item) => ({
			id: item.reviewer._id,
			forced: item.forced,
		})),
		[
			{ id: "hugo", forced: true },
			{ id: "ana", forced: false },
		],
	);
});

test("treats a single specific slot as a forced agent assignment", () => {
	assert.equal(isSingleForcedAssignment([{ strategy: "specific" }]), true);
	assert.equal(isSingleForcedAssignment([{ strategy: "random" }]), false);
	assert.equal(
		isSingleForcedAssignment([
			{ strategy: "specific" },
			{ strategy: "random" },
		]),
		false,
	);
	assert.equal(isForcedAssignmentStrategy("specific"), true);
	assert.equal(isForcedAssignmentStrategy("random"), false);
});

test("resolves tag slots and reports missing tag candidates", () => {
	const result = resolveAssignmentSlots({
		mode: "tag",
		selectedTagId: "frontend",
		slots: [
			{ strategy: "tag_random_selected" },
			{ strategy: "tag_random_other", tagId: "backend" },
		],
		reviewers: [
			reviewer("tag-disabled", 0, -1, {
				tags: ["frontend"],
				includedInTagRotations: false,
			}),
			reviewer("legacy-excluded", 0, 0, {
				tags: ["frontend"],
				excludedFromReviewPool: true,
			}),
			reviewer("frontend-reviewer", 0, 1, {
				tags: ["frontend"],
				excludedFromReviewPool: true,
				includedInTagRotations: true,
			}),
			reviewer("backend-reviewer", 0, 2, {
				tags: ["backend"],
				effectiveIsAbsent: true,
			}),
		],
	});

	assert.deepEqual(
		result.resolved.map(({ reviewer: selected }) => selected._id),
		["frontend-reviewer"],
	);
	assert.deepEqual(result.failed, [{ slotIndex: 1, reason: "no_candidates" }]);
});

test("counts how many regular assignments remain until a reviewer is next", () => {
	const reviewers = [
		reviewer("ana", 0, 1),
		reviewer("bruno", 1, 2),
		reviewer("carla", 1, 3),
		reviewer("out", 0, 0, { excludedFromReviewPool: true }),
		reviewer("away", 0, 0, { effectiveIsAbsent: true }),
	];

	assert.equal(countRegularAssignmentsUntilReviewer(reviewers, "ana"), 0);
	assert.equal(countRegularAssignmentsUntilReviewer(reviewers, "bruno"), 2);
	assert.equal(countRegularAssignmentsUntilReviewer(reviewers, "out"), null);
	assert.equal(countRegularAssignmentsUntilReviewer(reviewers, "away"), null);
});

test("counts through a large assignment-count gap", () => {
	const reviewers = [
		reviewer("ana", 0, 1),
		reviewer("bruno", 0, 2),
		reviewer("carla", 5, 3),
	];

	assert.equal(countRegularAssignmentsUntilReviewer(reviewers, "ana"), 0);
	assert.ok(
		(countRegularAssignmentsUntilReviewer(reviewers, "carla") ?? 0) > 3,
	);
});

const perTeam = (
	slots: { strategy: string; tagId?: string; teamSlug?: string }[],
	options: {
		mode?: "regular" | "tag";
		selectedTagId?: string;
		requesterEmail?: string;
	} = {},
) =>
	resolveAssignmentSlotsPerTeam({
		mode: options.mode ?? "regular",
		selectedTagId: options.selectedTagId,
		sourceTeamSlug: "home",
		requesterEmail: options.requesterEmail,
		slots,
		reviewersByTeam: new Map([
			[
				"home",
				[
					reviewer("ana", 3, 1, { email: "ana@x.com", tags: ["frontend"] }),
					reviewer("bea", 5, 2, { email: "bea@x.com" }),
					reviewer("me-home", 0, 3, { email: "me@x.com" }),
				],
			],
			[
				"other",
				[
					reviewer("me-other", 0, 4, { email: "me@x.com" }),
					reviewer("ana-other", 1, 5, { email: "ana@x.com" }),
					reviewer("caro", 2, 6, { email: "caro@x.com" }),
					reviewer("dani", 2, 7, { email: "dani@x.com" }),
				],
			],
			["empty", [reviewer("eva", 0, 8, { effectiveIsAbsent: true })]],
		]),
	});
const picked = (result: ReturnType<typeof perTeam>) =>
	result.resolved.map((item) => `${item.slotIndex}:${item.reviewer._id}`);

test("asks each team for its own reviewers, comparing counts only within a team", () => {
	const result = perTeam(
		[
			{ strategy: "random" },
			{ strategy: "random" },
			{ strategy: "random", teamSlug: "other" },
		],
		{ requesterEmail: "me@x.com" },
	);
	// Home gives Ana and Bea although Caro has fewer PRs; the other team skips
	// the requester and Ana, who are already home reviewers.
	assert.deepEqual(picked(result), ["0:ana", "1:bea", "2:caro"]);
	assert.deepEqual(result.failed, []);
});

test("leaves the requesting team out when no slot asks it", () => {
	const result = perTeam([
		{ strategy: "random", teamSlug: "other" },
		{ strategy: "random", teamSlug: "other" },
	]);
	assert.deepEqual(picked(result), ["0:me-other", "1:ana-other"]);
});

test("fails only the slots of a team with nobody available", () => {
	const result = perTeam([
		{ strategy: "random" },
		{ strategy: "random", teamSlug: "empty" },
	]);
	assert.deepEqual(picked(result), ["0:me-home"]);
	assert.deepEqual(result.failed, [{ slotIndex: 1, reason: "no_candidates" }]);
});

test("applies the tag rotation to the requesting team only", () => {
	const result = perTeam(
		[{ strategy: "random" }, { strategy: "random", teamSlug: "other" }],
		{ mode: "tag", selectedTagId: "frontend" },
	);
	assert.deepEqual(picked(result), ["0:ana", "1:me-other"]);
});
