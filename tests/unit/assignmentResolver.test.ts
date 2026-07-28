import assert from "node:assert/strict";
import test from "node:test";
import {
	type AssignmentResolverReviewer,
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
			reviewer("next", 0, 3),
			reviewer("after", 1, 4),
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
			reviewer("frontend-reviewer", 0, 1, { tags: ["frontend"] }),
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
