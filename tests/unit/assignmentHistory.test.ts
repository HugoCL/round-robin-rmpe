import assert from "node:assert/strict";
import test from "node:test";
import {
	legacyChatThreadLinks,
	mergeChatThreadLinks,
	resolveHistoryAssigner,
} from "../../lib/assignmentHistory";

test("keeps the stored assigner name when the reviewer is on another team", () => {
	assert.deepEqual(
		resolveHistoryAssigner({
			actionByReviewerId: "assigner-from-platform",
			actionByName: "Hugo Castro",
			reviewerById: new Map(),
		}),
		{ actionByName: "Hugo Castro" },
	);
});

test("prefers the live reviewer record when it is in the lookup map", () => {
	assert.deepEqual(
		resolveHistoryAssigner({
			actionByReviewerId: "assigner-from-platform",
			actionByName: "Old Name",
			reviewerById: new Map([
				[
					"assigner-from-platform",
					{ name: "Hugo Castro", email: "hugo@example.com" },
				],
			]),
		}),
		{ actionByName: "Hugo Castro", actionByEmail: "hugo@example.com" },
	);
});

test("still shows the assigner when only the stored name is present", () => {
	assert.deepEqual(
		resolveHistoryAssigner({
			actionByName: "Rosario Ferrer Donoso",
			reviewerById: new Map(),
		}),
		{ actionByName: "Rosario Ferrer Donoso" },
	);
});

test("merges Chat links from every notified team space", () => {
	assert.deepEqual(
		mergeChatThreadLinks(
			[{ teamSlug: "platform", teamName: "Platform", url: "https://chat/a" }],
			[
				{ teamSlug: "payments", teamName: "Payments", url: "https://chat/b" },
				{ teamSlug: "platform", teamName: "Platform", url: "https://chat/a2" },
			],
		),
		[
			{ teamSlug: "platform", teamName: "Platform", url: "https://chat/a2" },
			{ teamSlug: "payments", teamName: "Payments", url: "https://chat/b" },
		],
	);
});

test("falls back to the legacy single Chat link", () => {
	assert.deepEqual(legacyChatThreadLinks("https://chat/legacy", []), [
		{ teamSlug: "chat", teamName: "Chat", url: "https://chat/legacy" },
	]);
	assert.deepEqual(
		legacyChatThreadLinks("https://chat/legacy", [
			{ teamSlug: "payments", teamName: "Payments", url: "https://chat/b" },
		]),
		[{ teamSlug: "payments", teamName: "Payments", url: "https://chat/b" }],
	);
});
