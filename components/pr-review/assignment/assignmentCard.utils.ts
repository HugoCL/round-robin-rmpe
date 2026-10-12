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
	// Tags and people belong to this team: another team's slot is its rotation.
	if (slot.teamSlug) {
		return { id: slot.id, strategy: "random", teamSlug: slot.teamSlug };
	}
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

/** Who the regular rotation picks next, excluding `excludedIds`: fewest
 * assignments first, then whoever joined earliest. */
export function rotationQueue(
	candidates: Reviewer[],
	excludedIds: (Id<"reviewers"> | string | null | undefined)[],
): Reviewer[] {
	const excluded = new Set(excludedIds.filter(Boolean).map(String));
	return candidates
		.filter((reviewer) => !excluded.has(String(reviewer._id)))
		.sort(
			(a, b) =>
				a.assignmentCount - b.assignmentCount || a.createdAt - b.createdAt,
		);
}

export function findUpcomingAfterCurrent(
	candidates: Reviewer[],
	currentReviewerId: Id<"reviewers">,
): Reviewer | null {
	return rotationQueue(candidates, [currentReviewerId])[0] ?? null;
}
