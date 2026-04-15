import type { Id } from "@/convex/_generated/dataModel";
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
	const previews: ResolvedPreview["slots"] = [];
	const resolved: ResolvedPreview["resolved"] = [];
	const payloadSlots: ResolvedPreview["payloadSlots"] = [];
	const selectedReviewerIds = new Set<string>();
	const virtualCounts = new Map<string, number>(
		reviewers.map((reviewer) => [
			String(reviewer._id),
			reviewer.assignmentCount,
		]),
	);
	const tagNameMap = new Map(tags.map((tag) => [String(tag._id), tag.name]));

	for (const [slotIndex, rawSlot] of slotConfigs.entries()) {
		const slot = normalizeSlotForMode(rawSlot, mode);
		payloadSlots.push({
			strategy: slot.strategy,
			reviewerId: slot.reviewerId,
			tagId: slot.tagId,
		});

		const unresolved = (reason: string) => {
			previews.push({
				slotIndex,
				status: "unresolved",
				reason,
			});
		};

		if (slot.strategy === "specific") {
			if (!slot.reviewerId) {
				unresolved(reasonMessages.missingReviewer);
				continue;
			}
			const target = reviewers.find(
				(reviewer) => reviewer._id === slot.reviewerId,
			);
			if (!target) {
				unresolved(reasonMessages.reviewerNotFound);
				continue;
			}
			if (target.effectiveIsAbsent) {
				unresolved(reasonMessages.reviewerAbsent);
				continue;
			}
			if (selectedReviewerIds.has(String(target._id))) {
				unresolved(reasonMessages.duplicateReviewer);
				continue;
			}
			selectedReviewerIds.add(String(target._id));
			virtualCounts.set(String(target._id), target.assignmentCount + 1);
			resolved.push({
				slotIndex,
				reviewer: target,
				tagId: slot.tagId,
			});
			previews.push({
				slotIndex,
				status: "resolved",
				reviewerName: target.name,
				tagName: slot.tagId ? tagNameMap.get(String(slot.tagId)) : undefined,
			});
			continue;
		}

		let requiredTagId: Id<"tags"> | undefined;
		if (mode === "regular") {
			if (slot.strategy !== "random") {
				unresolved(reasonMessages.invalidStrategy);
				continue;
			}
		} else {
			if (slot.strategy === "tag_random_selected") {
				requiredTagId = selectedTagId;
			} else if (slot.strategy === "tag_random_other") {
				requiredTagId = slot.tagId;
			} else {
				unresolved(reasonMessages.invalidStrategy);
				continue;
			}
			if (!requiredTagId) {
				unresolved(
					slot.strategy === "tag_random_selected"
						? reasonMessages.missingSelectedTag
						: reasonMessages.missingTag,
				);
				continue;
			}
		}

		const candidates = reviewers.filter((reviewer) => {
			if (reviewer.effectiveIsAbsent) return false;
			if (currentUserReviewerId && reviewer._id === currentUserReviewerId) {
				return false;
			}
			if (selectedReviewerIds.has(String(reviewer._id))) return false;
			if (requiredTagId && !reviewer.tags.includes(requiredTagId)) return false;
			return true;
		});

		const selected = [...candidates].sort((a, b) => {
			const aCount = virtualCounts.get(String(a._id)) ?? a.assignmentCount;
			const bCount = virtualCounts.get(String(b._id)) ?? b.assignmentCount;
			if (aCount !== bCount) return aCount - bCount;
			return a.createdAt - b.createdAt;
		})[0];

		if (!selected) {
			unresolved(reasonMessages.noCandidates);
			continue;
		}

		selectedReviewerIds.add(String(selected._id));
		virtualCounts.set(String(selected._id), selected.assignmentCount + 1);
		resolved.push({
			slotIndex,
			reviewer: selected,
			tagId: requiredTagId,
		});
		previews.push({
			slotIndex,
			status: "resolved",
			reviewerName: selected.name,
			tagName: requiredTagId
				? tagNameMap.get(String(requiredTagId))
				: undefined,
		});
	}

	return {
		slots: previews,
		resolved,
		payloadSlots,
	};
}
