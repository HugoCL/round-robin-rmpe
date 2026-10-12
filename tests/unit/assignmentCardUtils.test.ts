import assert from "node:assert/strict";
import test from "node:test";
import {
	normalizeSlotForMode,
	rotationQueue,
} from "../../components/pr-review/assignment/assignmentCard.utils";
import type { Reviewer } from "../../lib/types";

const reviewer = (
	id: string,
	assignmentCount: number,
	createdAt: number,
): Reviewer =>
	({ _id: id, name: id, assignmentCount, createdAt }) as unknown as Reviewer;

test("orders by fewest assignments, then earliest joiner, skipping excluded", () => {
	const queue = rotationQueue(
		[
			reviewer("late-low", 1, 30),
			reviewer("current", 0, 5),
			reviewer("early-low", 1, 10),
			reviewer("high", 3, 1),
			reviewer("me", 0, 20),
		],
		["current", null, "me"],
	);
	assert.deepEqual(
		queue.map((item) => item._id),
		["early-low", "late-low", "high"],
	);
});

test("keeps another team's reviewer on that team's rotation in any mode", () => {
	const slot = {
		id: "s1",
		strategy: "tag_random_other" as const,
		tagId: "frontend" as never,
		reviewerId: "ana" as never,
		teamSlug: "demo-pagos",
	};
	for (const mode of ["regular", "tag"] as const) {
		assert.deepEqual(normalizeSlotForMode(slot, mode), {
			id: "s1",
			strategy: "random",
			teamSlug: "demo-pagos",
		});
	}
	assert.equal(
		normalizeSlotForMode({ id: "s2", strategy: "random" }, "tag").strategy,
		"tag_random_selected",
	);
});
