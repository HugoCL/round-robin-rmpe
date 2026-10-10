import assert from "node:assert/strict";
import test from "node:test";
import { rotationQueue } from "../../components/pr-review/assignment/assignmentCard.utils";
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
