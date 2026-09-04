import assert from "node:assert/strict";
import test from "node:test";
import {
	resolveAgentCrossTeamFlags,
	resolveAgentNotifyFlag,
	shouldQueueAgentAssignmentChat,
} from "../../lib/agentAssignmentChat";

test("queues Google Chat for agent assignments that have a PR URL", () => {
	assert.equal(
		shouldQueueAgentAssignmentChat({
			source: "agent",
			prUrl: "https://github.com/org/repo/pull/12",
			assignedCount: 1,
		}),
		true,
	);
});

test("does not queue Google Chat for UI assignments", () => {
	assert.equal(
		shouldQueueAgentAssignmentChat({
			source: "ui",
			prUrl: "https://github.com/org/repo/pull/12",
			assignedCount: 1,
		}),
		false,
	);
});

test("does not queue Google Chat without a PR URL or assigned reviewers", () => {
	assert.equal(
		shouldQueueAgentAssignmentChat({
			source: "agent",
			prUrl: "   ",
			assignedCount: 1,
		}),
		false,
	);
	assert.equal(
		shouldQueueAgentAssignmentChat({
			source: "agent",
			prUrl: "https://github.com/org/repo/pull/12",
			assignedCount: 0,
		}),
		false,
	);
});

test("always notifies from agent assignments, even if notify is omitted or false", () => {
	assert.equal(resolveAgentNotifyFlag(undefined), true);
	assert.equal(resolveAgentNotifyFlag(true), true);
	assert.equal(resolveAgentNotifyFlag(false), true);
});

test("treats extra team slugs as a cross-team assignment even without the flag", () => {
	assert.deepEqual(
		resolveAgentCrossTeamFlags({
			sourceTeamSlug: "platform",
			additionalTeamSlugs: ["payments", "platform", " payments "],
		}),
		{ crossTeamReview: true, additionalTeamSlugs: ["payments"] },
	);
});

test("keeps same-team agent assignments from broadcasting", () => {
	assert.deepEqual(
		resolveAgentCrossTeamFlags({
			sourceTeamSlug: "platform",
			crossTeamReview: true,
			additionalTeamSlugs: ["platform"],
		}),
		{ crossTeamReview: false, additionalTeamSlugs: [] },
	);
});
