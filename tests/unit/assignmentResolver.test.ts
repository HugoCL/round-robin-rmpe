import assert from "node:assert/strict";
import test from "node:test";
import {
	type AssignmentResolverReviewer,
	countRegularAssignmentsUntilReviewer,
	resolveAssignmentSlots,
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
