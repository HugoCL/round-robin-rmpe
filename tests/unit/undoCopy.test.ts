import assert from "node:assert/strict";
import test from "node:test";
import type { useTranslations } from "next-intl";
import { lastAssignmentUndoCopy } from "../../components/pr-review/assignment/undoCopy";
import type {
	AssignmentItem,
	GroupedAssignmentHistoryItem,
} from "../../lib/types";

const t = ((key: string) => key) as unknown as ReturnType<
	typeof useTranslations
>;
const item = {
	reviewerId: "ana",
	reviewerName: "Ana",
	timestamp: 100,
	prUrl: "https://github.com/acme/app/pull/1",
	wasSkipped: false,
} as AssignmentItem;
const historyEntry = (googleChatThreadUrl?: string) =>
	({
		googleChatThreadUrl,
		reviewers: [{ reviewerId: "ana", reviewerName: "Ana", timestamp: 100 }],
	}) as GroupedAssignmentHistoryItem;

test("mentions the Chat notice only once it was delivered", () => {
	assert.equal(
		lastAssignmentUndoCopy(
			t,
			[item],
			[historyEntry("https://chat.google.com/room/a/b")],
		).chatNote,
		"history.undoLastChatNote",
	);
	assert.equal(
		lastAssignmentUndoCopy(t, [item], [historyEntry()]).chatNote,
		null,
	);
});

test("names everyone in the batch that undo takes back", () => {
	const t = ((key: string, values?: { name?: string }) =>
		`${key}:${values?.name}`) as unknown as ReturnType<typeof useTranslations>;
	const batch = [
		{ ...item, batchId: "b1" },
		{ ...item, reviewerId: "juan", reviewerName: "Juan", batchId: "b1" },
		{ ...item, reviewerId: "eva", reviewerName: "Eva", batchId: "b0" },
	];
	assert.equal(
		lastAssignmentUndoCopy(t, batch, undefined).title,
		"history.undoLastTitlePr:Ana, Juan",
	);
});

test("names the whole batch from history when the feed cut it", () => {
	const t = ((key: string, values?: { name?: string }) =>
		`${key}:${values?.name}`) as unknown as ReturnType<typeof useTranslations>;
	const entry = {
		reviewers: [
			{ reviewerId: "ana", reviewerName: "Ana", timestamp: 100 },
			{ reviewerId: "juan", reviewerName: "Juan", timestamp: 100 },
			{ reviewerId: "eva", reviewerName: "Eva", timestamp: 100 },
		],
	} as GroupedAssignmentHistoryItem;
	assert.equal(
		lastAssignmentUndoCopy(t, [{ ...item, batchId: "b1" }], [entry]).title,
		"history.undoLastTitlePr:Ana, Juan, Eva",
	);
});
