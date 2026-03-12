import type { Id } from "@/convex/_generated/dataModel";
import type {
	AbsenceReason,
	PartTimeSchedule,
} from "@/lib/reviewerAvailability";

export interface Reviewer {
	_id: Id<"reviewers">;
	_creationTime: number;
	teamId?: Id<"teams">;
	name: string;
	email: string;
	googleChatUserId?: string;
	assignmentCount: number;
	isAbsent: boolean;
	absentUntil?: number;
	partTimeSchedule?: PartTimeSchedule;
	createdAt: number;
	tags: Id<"tags">[];
	manualIsAbsent: boolean;
	isOffTodayBySchedule: boolean;
	effectiveIsAbsent: boolean;
	absenceReason: AbsenceReason;
}

export interface UserInfo {
	email: string;
	firstName?: string;
	lastName?: string;
	googleChatUserId?: string; // optional chat user id for tagging assigner
}

export interface AssignmentItem {
	id: string;
	reviewerId: string;
	reviewerName: string;
	timestamp: number;
	batchId?: string;
	isForced: boolean;
	wasSkipped: boolean;
	isAbsentSkip: boolean;
	urgent: boolean;
	actionByName?: string;
	actionByEmail?: string;
	prUrl?: string;
	tagId?: string;
}

export interface Assignment {
	items: AssignmentItem[];
	lastAssigned: {
		reviewerId: string;
		timestamp: number;
	} | null;
}

export interface GroupedAssignmentHistoryReviewer {
	reviewerId: string;
	reviewerName: string;
	tagId?: string;
	timestamp: number;
}

export interface GroupedAssignmentHistoryItem {
	id: string;
	batchId?: string;
	timestamp: number;
	forced: boolean;
	skipped: boolean;
	isAbsentSkip: boolean;
	urgent: boolean;
	prUrl?: string;
	contextUrl?: string;
	actionByName?: string;
	actionByEmail?: string;
	reviewers: GroupedAssignmentHistoryReviewer[];
	reviewerCount: number;
}
