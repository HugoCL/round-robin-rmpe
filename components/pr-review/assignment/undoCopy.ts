import type { useTranslations } from "next-intl";
import { parsePrUrl } from "@/lib/prUrl";
import type { AssignmentItem, GroupedAssignmentHistoryItem } from "@/lib/types";

export type UndoCopy = {
	/** Confirm title naming what goes away. */
	title: string;
	/** Accessible name and tooltip of the undo control. */
	label: string;
	/** Set when the person already got the Chat notice, which undo cannot recall. */
	chatNote: string | null;
};

/**
 * "Undo" acts on the team's latest assignment; naming its PR and person in the
 * confirm keeps people from undoing something they did not mean to.
 */
export function lastAssignmentUndoCopy(
	t: ReturnType<typeof useTranslations>,
	feedItems: AssignmentItem[],
	history: GroupedAssignmentHistoryItem[] | undefined,
): UndoCopy {
	const item = feedItems[0];
	if (!item) {
		return {
			title: t("history.undoConfirmTitle"),
			label: t("pr.undoLastAssignment"),
			chatNote: null,
		};
	}
	const number = item.prUrl ? parsePrUrl(item.prUrl)?.number : undefined;
	// Undo takes back a whole batch, so the copy names everyone in it. The feed
	// keeps only the last few rows and can cut a batch; history groups it whole.
	const entry = history?.find((candidate) =>
		candidate.reviewers.some(
			(reviewer) =>
				reviewer.reviewerId === item.reviewerId &&
				reviewer.timestamp === item.timestamp,
		),
	);
	const names = entry
		? entry.reviewers.map((reviewer) => reviewer.reviewerName)
		: (item.batchId
				? feedItems.filter((feedItem) => feedItem.batchId === item.batchId)
				: [item]
			).map((feedItem) => feedItem.reviewerName);
	const name = names.join(", ");
	// History rows only get a Chat thread link after the notice went out.
	const chatDelivered = !!entry?.googleChatThreadUrl;
	return {
		title: number
			? t("history.undoLastTitlePr", { number, name })
			: t("history.undoLastTitle", { name }),
		label: number
			? t("history.undoEntryPr", { number, name })
			: t("history.undoEntry", { name }),
		chatNote:
			chatDelivered && !item.wasSkipped
				? t("history.undoLastChatNote", { name, count: names.length })
				: null,
	};
}
