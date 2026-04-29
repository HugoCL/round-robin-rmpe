export interface PRData {
	url: string;
	title: string;
	author: string;
	repoFullName: string;
	prNumber: string;
}

export interface ReviewerInfo {
	_id: string;
	name: string;
	email: string;
	assignmentCount: number;
	isAbsent: boolean;
	excludedFromReviewPool?: boolean;
	manualIsAbsent: boolean;
	effectiveIsAbsent: boolean;
	absenceReason: "manual" | "part_time_schedule" | null;
	createdAt: number;
	tags: string[];
	googleChatUserId?: string;
	teamId: string;
	partTimeSchedule?: {
		workingDays: string[];
	};
}

export interface TagInfo {
	_id: string;
	name: string;
	color: string;
	teamId: string;
}

export interface TeamInfo {
	_id: string;
	name: string;
	slug: string;
	googleChatWebhookUrl?: string;
}

export interface AssignmentResult {
	success: boolean;
	reviewer?: {
		id: string;
		name: string;
		email: string;
		assignmentCount: number;
		isAbsent: boolean;
		effectiveIsAbsent: boolean;
		createdAt: number;
		tags: string[];
	};
}

export interface BatchAssignmentResult {
	success: boolean;
	batchId?: string;
	assigned: Array<{
		slotIndex: number;
		reviewer: {
			id: string;
			name: string;
			email: string;
			assignmentCount: number;
			isAbsent: boolean;
			effectiveIsAbsent: boolean;
			createdAt: number;
			tags: string[];
		};
		tagId?: string;
	}>;
	failed: Array<{
		slotIndex: number;
		reason: string;
	}>;
	assignedCount: number;
	failedCount: number;
	totalRequested: number;
}

export interface AlreadyAssignedInfo {
	reviewerName: string;
	timestamp: number;
}

export type AssignmentStatus = "idle" | "assigning" | "success" | "error";

// ── Slot-based multi-assignment types (mirrors main app) ──

export type SlotStrategy =
	| "random" // round-robin from all available (regular mode)
	| "specific" // user picks an exact reviewer (both modes)
	| "tag_random_selected" // round-robin within the globally-selected tag (tag mode)
	| "tag_random_other"; // round-robin within a per-slot tag (tag mode)

export type AssignmentMode = "regular" | "tag";

export interface SlotConfig {
	id: string;
	strategy: SlotStrategy;
	reviewerId?: string;
	tagId?: string;
}

export interface SlotPreview {
	slotIndex: number;
	status: "resolved" | "unresolved";
	reviewerName?: string;
	tagName?: string;
	reason?: string;
}
