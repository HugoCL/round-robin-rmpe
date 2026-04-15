import type { Id } from "@/convex/_generated/dataModel";
import type { Reviewer } from "@/lib/types";
import type { AssignmentMode } from "./assignmentCard.types";
import type { ReviewerSlotConfig } from "./ReviewerSlotsConfigurator";

export const createSlotId = () =>
	`slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const defaultSlotForMode = (
	mode: AssignmentMode,
): ReviewerSlotConfig => ({
	id: createSlotId(),
	strategy: mode === "regular" ? "random" : "tag_random_selected",
});

export function normalizeSlotForMode(
	slot: ReviewerSlotConfig,
	mode: AssignmentMode,
): ReviewerSlotConfig {
	const next = { ...slot };
	if (mode === "regular") {
		if (next.strategy !== "random" && next.strategy !== "specific") {
			next.strategy = "random";
		}
	} else if (
		next.strategy !== "tag_random_selected" &&
		next.strategy !== "tag_random_other" &&
		next.strategy !== "specific"
	) {
		next.strategy = "tag_random_selected";
	}

	if (next.strategy !== "specific") {
		next.reviewerId = undefined;
	}
	if (next.strategy !== "tag_random_other") {
		next.tagId = undefined;
	}
	return next;
}

export function findUpcomingAfterCurrent(
	candidates: Reviewer[],
	currentReviewerId: Id<"reviewers">,
): Reviewer | null {
	if (candidates.length <= 1) return null;

	const minCount = Math.min(
		...candidates.map((reviewer) => reviewer.assignmentCount),
	);
	const candidatesWithSameCount = candidates
		.filter(
			(reviewer) =>
				reviewer.assignmentCount === minCount &&
				reviewer._id !== currentReviewerId,
		)
		.sort((a, b) => a.createdAt - b.createdAt);

	if (candidatesWithSameCount.length > 0) {
		return candidatesWithSameCount[0];
	}

	const higherCountCandidates = candidates.filter(
		(reviewer) =>
			reviewer.assignmentCount > minCount && reviewer._id !== currentReviewerId,
	);

	if (higherCountCandidates.length === 0) return null;

	const nextMinCount = Math.min(
		...higherCountCandidates.map((reviewer) => reviewer.assignmentCount),
	);

	return (
		higherCountCandidates
			.filter((reviewer) => reviewer.assignmentCount === nextMinCount)
			.sort((a, b) => a.createdAt - b.createdAt)[0] || null
	);
}
