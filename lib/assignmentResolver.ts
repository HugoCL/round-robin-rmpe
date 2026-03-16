export type AssignmentMode = "regular" | "tag";

export type AssignmentSlotStrategy =
	| "random"
	| "specific"
	| "tag_random_selected"
	| "tag_random_other";

export type AssignmentFailureReason =
	| "invalid_strategy"
	| "missing_reviewer"
	| "reviewer_not_found"
	| "reviewer_absent"
	| "duplicate_reviewer"
	| "missing_tag"
	| "no_candidates";

export type AssignmentSlotInput<ReviewerId = string, TagId = string> = {
	strategy: AssignmentSlotStrategy | string;
	reviewerId?: ReviewerId;
	tagId?: TagId;
};

export type AssignmentResolverReviewer<ReviewerId = string, TagId = string> = {
	_id: ReviewerId;
	name: string;
	email?: string;
	assignmentCount: number;
	createdAt: number;
	effectiveIsAbsent: boolean;
	tags: TagId[];
};

export type AssignmentResolvedSlot<
	ReviewerId = string,
	TagId = string,
	Reviewer extends AssignmentResolverReviewer<
		ReviewerId,
		TagId
	> = AssignmentResolverReviewer<ReviewerId, TagId>,
> = {
	slotIndex: number;
	reviewer: Reviewer;
	tagId?: TagId;
};

export type AssignmentFailedSlot = {
	slotIndex: number;
	reason: AssignmentFailureReason;
};

export type AssignmentResolverResult<
	ReviewerId = string,
	TagId = string,
	Reviewer extends AssignmentResolverReviewer<
		ReviewerId,
		TagId
	> = AssignmentResolverReviewer<ReviewerId, TagId>,
> = {
	resolved: AssignmentResolvedSlot<ReviewerId, TagId, Reviewer>[];
	failed: AssignmentFailedSlot[];
	totalRequested: number;
};

type ResolveAssignmentSlotsArgs<
	ReviewerId = string,
	TagId = string,
	Reviewer extends AssignmentResolverReviewer<
		ReviewerId,
		TagId
	> = AssignmentResolverReviewer<ReviewerId, TagId>,
> = {
	mode: AssignmentMode;
	selectedTagId?: TagId;
	slots: AssignmentSlotInput<ReviewerId, TagId>[];
	reviewers: Reviewer[];
	excludedReviewerId?: ReviewerId;
};

function toKey(value: unknown) {
	return String(value);
}

export function resolveAssignmentSlots<
	ReviewerId = string,
	TagId = string,
	Reviewer extends AssignmentResolverReviewer<
		ReviewerId,
		TagId
	> = AssignmentResolverReviewer<ReviewerId, TagId>,
>({
	mode,
	selectedTagId,
	slots,
	reviewers,
	excludedReviewerId,
}: ResolveAssignmentSlotsArgs<
	ReviewerId,
	TagId,
	Reviewer
>): AssignmentResolverResult<ReviewerId, TagId, Reviewer> {
	if (slots.length === 0) {
		return {
			resolved: [],
			failed: [{ slotIndex: 0, reason: "no_candidates" }],
			totalRequested: 0,
		};
	}

	const reviewerById = new Map<string, Reviewer>();
	const virtualCounts = new Map<string, number>();
	for (const reviewer of reviewers) {
		const key = toKey(reviewer._id);
		reviewerById.set(key, reviewer);
		virtualCounts.set(key, reviewer.assignmentCount);
	}

	const selectedReviewerIds = new Set<string>();
	const resolved: AssignmentResolvedSlot<ReviewerId, TagId, Reviewer>[] = [];
	const failed: AssignmentFailedSlot[] = [];

	for (const [slotIndex, slot] of slots.entries()) {
		const strategy = slot.strategy as AssignmentSlotStrategy;
		let chosenTagId: TagId | undefined;

		if (strategy === "specific") {
			if (!slot.reviewerId) {
				failed.push({ slotIndex, reason: "missing_reviewer" });
				continue;
			}
			const reviewer = reviewerById.get(toKey(slot.reviewerId));
			if (!reviewer) {
				failed.push({ slotIndex, reason: "reviewer_not_found" });
				continue;
			}
			if (reviewer.effectiveIsAbsent) {
				failed.push({ slotIndex, reason: "reviewer_absent" });
				continue;
			}
			if (selectedReviewerIds.has(toKey(reviewer._id))) {
				failed.push({ slotIndex, reason: "duplicate_reviewer" });
				continue;
			}

			selectedReviewerIds.add(toKey(reviewer._id));
			virtualCounts.set(
				toKey(reviewer._id),
				(virtualCounts.get(toKey(reviewer._id)) ?? reviewer.assignmentCount) +
					1,
			);
			resolved.push({
				slotIndex,
				reviewer,
				tagId: slot.tagId,
			});
			continue;
		}

		if (mode === "regular") {
			if (strategy !== "random") {
				failed.push({ slotIndex, reason: "invalid_strategy" });
				continue;
			}
		} else if (mode === "tag") {
			if (strategy === "tag_random_selected") {
				chosenTagId = selectedTagId;
			} else if (strategy === "tag_random_other") {
				chosenTagId = slot.tagId;
			} else if (strategy === "random") {
				chosenTagId = selectedTagId;
			} else {
				failed.push({ slotIndex, reason: "invalid_strategy" });
				continue;
			}

			if (!chosenTagId) {
				failed.push({ slotIndex, reason: "missing_tag" });
				continue;
			}
		} else {
			failed.push({ slotIndex, reason: "invalid_strategy" });
			continue;
		}

		const candidates = reviewers.filter((reviewer) => {
			if (reviewer.effectiveIsAbsent) return false;
			if (
				excludedReviewerId !== undefined &&
				toKey(reviewer._id) === toKey(excludedReviewerId)
			) {
				return false;
			}
			if (selectedReviewerIds.has(toKey(reviewer._id))) return false;
			if (
				chosenTagId !== undefined &&
				!reviewer.tags.some((tagId) => toKey(tagId) === toKey(chosenTagId))
			) {
				return false;
			}
			return true;
		});

		const selected = [...candidates].sort((a, b) => {
			const aCount = virtualCounts.get(toKey(a._id)) ?? a.assignmentCount;
			const bCount = virtualCounts.get(toKey(b._id)) ?? b.assignmentCount;
			if (aCount !== bCount) return aCount - bCount;
			return a.createdAt - b.createdAt;
		})[0];

		if (!selected) {
			failed.push({ slotIndex, reason: "no_candidates" });
			continue;
		}

		selectedReviewerIds.add(toKey(selected._id));
		virtualCounts.set(
			toKey(selected._id),
			(virtualCounts.get(toKey(selected._id)) ?? selected.assignmentCount) + 1,
		);
		resolved.push({
			slotIndex,
			reviewer: selected,
			tagId: chosenTagId,
		});
	}

	return {
		resolved,
		failed,
		totalRequested: slots.length,
	};
}
