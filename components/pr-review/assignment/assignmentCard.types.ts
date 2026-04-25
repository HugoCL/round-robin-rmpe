import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Reviewer } from "@/lib/types";
import type {
	ReviewerSlotPreview,
	ReviewerSlotStrategy,
} from "./ReviewerSlotsConfigurator";

export type AssignmentMode = "regular" | "tag";

export type AssignmentPayloadSlot = {
	strategy: ReviewerSlotStrategy;
	reviewerId?: Id<"reviewers">;
	tagId?: Id<"tags">;
};

export type ResolvedSlot = {
	slotIndex: number;
	reviewer: Reviewer;
	tagId?: Id<"tags">;
};

export type ResolvedPreview = {
	slots: ReviewerSlotPreview[];
	resolved: ResolvedSlot[];
	payloadSlots: AssignmentPayloadSlot[];
};

export type AssignmentResolverReasonMessages = {
	missingReviewer: string;
	reviewerNotFound: string;
	reviewerAbsent: string;
	duplicateReviewer: string;
	invalidStrategy: string;
	missingSelectedTag: string;
	missingTag: string;
	noCandidates: string;
};

export type AssignmentCardTag = Doc<"tags">;
