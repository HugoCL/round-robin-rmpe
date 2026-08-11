import assert from "node:assert/strict";
import test from "node:test";
import { undoRemovesReviewedPR } from "../../lib/historyUndo";

test("only decrements the reviewed PR total for real assignments", () => {
	assert.equal(
		undoRemovesReviewedPR([
			{ skipped: false, isAbsentSkip: false },
			{ skipped: false, isAbsentSkip: false },
		]),
		true,
	);
	assert.equal(
		undoRemovesReviewedPR([
			{ skipped: true, isAbsentSkip: false },
			{ skipped: false, isAbsentSkip: true },
		]),
		false,
	);
});
