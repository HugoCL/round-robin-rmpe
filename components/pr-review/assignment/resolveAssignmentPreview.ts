import type { Id } from "@/convex/_generated/dataModel";
import {
	type AssignmentFailureReason,
	resolveAssignmentSlots,
} from "@/lib/assignmentResolver";
import type { Reviewer } from "@/lib/types";
import type {
	AssignmentCardTag,
	AssignmentMode,
	AssignmentResolverReasonMessages,
	ResolvedPreview,
} from "./assignmentCard.types";
import { normalizeSlotForMode } from "./assignmentCard.utils";
import type { ReviewerSlotConfig } from "./ReviewerSlotsConfigurator";

type ResolveAssignmentPreviewInput = {
	mode: AssignmentMode;
	slotConfigs: ReviewerSlotConfig[];
	reviewers: Reviewer[];
	tags: AssignmentCardTag[];
	selectedTagId?: Id<"tags">;
	currentUserReviewerId?: Id<"reviewers">;
	reasonMessages: AssignmentResolverReasonMessages;
};

export function resolveAssignmentPreview({
	mode,
	slotConfigs,
	reviewers,
	tags,
	selectedTagId,
	currentUserReviewerId,
	reasonMessages,
}: ResolveAssignmentPreviewInput): ResolvedPreview {
	const payloadSlots = slotConfigs.map((rawSlot) => {
		const slot = normalizeSlotForMode(rawSlot, mode);
		return {
			strategy: slot.strategy,
			reviewerId: slot.reviewerId,
			tagId: slot.tagId,
		};
	});
	const resolution = resolveAssignmentSlots<
		Id<"reviewers">,
		Id<"tags">,
		Reviewer
	>({
		mode,
		selectedTagId,
		slots: payloadSlots,
		reviewers,
		excludedReviewerId: currentUserReviewerId,
	});
	const resolvedBySlot = new Map(
		resolution.resolved.map((item) => [item.slotIndex, item]),
	);
	const tagNameMap = new Map(tags.map((tag) => [String(tag._id), tag.name]));
	const failureBySlot = new Map(
		resolution.failed.map((item) => [item.slotIndex, item.reason]),
	);
	const messageForFailure = (
		reason: AssignmentFailureReason,
		slotIndex: number,
	) => {
		switch (reason) {
			case "missing_reviewer":
				return reasonMessages.missingReviewer;
			case "reviewer_not_found":
				return reasonMessages.reviewerNotFound;
			case "reviewer_absent":
				return reasonMessages.reviewerAbsent;
			case "duplicate_reviewer":
				return reasonMessages.duplicateReviewer;
			case "invalid_strategy":
				return reasonMessages.invalidStrategy;
			case "missing_tag":
				return payloadSlots[slotIndex]?.strategy === "tag_random_selected"
					? reasonMessages.missingSelectedTag
					: reasonMessages.missingTag;
			case "no_candidates":
				return reasonMessages.noCandidates;
		}
	};
	const previews = payloadSlots.map((_, slotIndex) => {
		const resolved = resolvedBySlot.get(slotIndex);
		if (resolved) {
			return {
				slotIndex,
				status: "resolved" as const,
				reviewerName: resolved.reviewer.name,
				tagName: resolved.tagId
					? tagNameMap.get(String(resolved.tagId))
					: undefined,
			};
		}
		const reason = failureBySlot.get(slotIndex) ?? "no_candidates";
		return {
			slotIndex,
			status: "unresolved" as const,
			reason: messageForFailure(reason, slotIndex),
		};
	});

	return {
		slots: previews,
		resolved: resolution.resolved,
		payloadSlots,
	};
}
