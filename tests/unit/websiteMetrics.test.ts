import assert from "node:assert/strict";
import test from "node:test";
import { summarizeRecentAssignments } from "../../lib/websiteMetrics";

test("groups multi-reviewer batches and excludes skips from recent metrics", () => {
	const now = Date.UTC(2026, 6, 30, 12);
	const rows = [
		{
			id: "batch-a-1",
			batchId: "batch-a",
			timestamp: Date.UTC(2026, 6, 30, 8),
			skipped: false,
			isAbsentSkip: false,
			source: "ui" as const,
		},
		{
			id: "batch-a-2",
			batchId: "batch-a",
			timestamp: Date.UTC(2026, 6, 30, 8),
			skipped: false,
			isAbsentSkip: false,
			urgent: true,
			source: "agent" as const,
		},
		{
			id: "single-b",
			timestamp: Date.UTC(2026, 6, 29, 8),
			skipped: false,
			isAbsentSkip: false,
			crossTeamReview: true,
		},
		{
			id: "skipped",
			timestamp: Date.UTC(2026, 6, 29, 8),
			skipped: true,
			isAbsentSkip: false,
		},
	];

	const metrics = summarizeRecentAssignments(rows, now);

	assert.equal(metrics.total, 2);
	assert.equal(metrics.viaAgent, 1);
	assert.equal(metrics.urgent, 1);
	assert.equal(metrics.crossTeam, 1);
	assert.deepEqual(
		metrics.dailyActivity.map(({ count }) => count),
		[0, 0, 0, 0, 0, 1, 1],
	);
});
