import type { Doc } from "@/convex/_generated/dataModel";

export type Reviewer = Doc<"reviewers">;

export interface UserInfo {
	email: string;
	firstName?: string;
	lastName?: string;
}

export interface AssignmentItem {
	id: string;
	reviewerId: string;
	reviewerName: string;
	timestamp: number;
	isForced: boolean;
	wasSkipped: boolean;
	isAbsentSkip: boolean;
	actionBy?: string;
	tagId?: string;
}

export interface Assignment {
	items: AssignmentItem[];
	lastAssigned: {
		reviewerId: string;
		timestamp: number;
	} | null;
}
