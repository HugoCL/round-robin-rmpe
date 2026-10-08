"use client";

import { createContext, useContext } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { DateKeyRange } from "@/lib/plannedAbsences";
import type { PartTimeSchedule } from "@/lib/reviewerAvailability";
import type { Assignment, Reviewer, UserInfo } from "@/lib/types";

export interface PRReviewContextValue {
	teamSlug?: string;
	isAdmin: boolean;
	isForeignTeamView: boolean;
	canManageCurrentTeam: boolean;
	// Visibility / layout
	showAssignments: boolean;
	toggleShowAssignments: () => void;
	myAssignmentsOnly: boolean;
	toggleMyAssignmentsOnly: () => void;
	showTags: boolean;
	toggleShowTags: () => void;
	showEmails: boolean;
	toggleShowEmails: () => void;
	hideMultiAssignmentSection: boolean;
	toggleHideMultiAssignmentSection: () => void;
	openSnapshotDialog: () => void;

	// Data
	reviewers: Reviewer[];
	nextReviewer: Reviewer | null;
	assignmentFeed: Assignment;
	hasTags: boolean;
	userInfo: UserInfo | null;
	/** Scheduled + active planned absences of the team ([] while loading). */
	plannedAbsences: Doc<"reviewerAbsences">[];
	teamTimezone: string;

	// Loading / refresh
	isRefreshing: boolean;
	formatLastUpdated: () => string;
	handleManualRefresh: () => Promise<void>;
	onDataUpdate: () => Promise<void>;

	// Reviewer actions
	assignPR: (opts?: {
		prUrl?: string;
		contextUrl?: string;
		urgent?: boolean;
	}) => Promise<void>;
	undoAssignment: () => Promise<void>;
	autoSkipAndAssign: (opts?: {
		prUrl?: string;
		contextUrl?: string;
		urgent?: boolean;
	}) => Promise<void>;
	skipReviewer: (opts?: {
		prUrl?: string;
		contextUrl?: string;
		urgent?: boolean;
	}) => Promise<void>;
	onToggleAbsence: (id: Id<"reviewers">) => Promise<void>;
	onMarkAbsent: (id: Id<"reviewers">, absentUntil?: number) => Promise<void>;
	onMarkAvailable: (id: Id<"reviewers">) => Promise<void>;
	onScheduleAbsence: (
		reviewerId: Id<"reviewers">,
		range: DateKeyRange,
	) => Promise<boolean>;
	onUpdateAbsence: (
		absenceId: Id<"reviewerAbsences">,
		range: DateKeyRange,
	) => Promise<boolean>;
	onCancelAbsence: (absenceId: Id<"reviewerAbsences">) => Promise<boolean>;
	onSetExcludedFromReviewPool: (
		id: Id<"reviewers">,
		excluded: boolean,
	) => Promise<void>;
	updateReviewer: (
		id: Id<"reviewers">,
		name: string,
		email: string,
		googleChatUserId?: string,
		partTimeSchedule?: PartTimeSchedule,
		excludedFromReviewPool?: boolean,
		includedInTagRotations?: boolean,
	) => Promise<boolean>;
	setReviewerBirthday: (
		reviewerId: Id<"reviewers">,
		month: number,
		day: number,
	) => Promise<boolean>;
	addReviewer: (
		name: string,
		email: string,
		googleChatUserId?: string,
		partTimeSchedule?: PartTimeSchedule,
	) => Promise<boolean>;
	removeReviewer: (id: Id<"reviewers">) => Promise<void>;
	handleResetCounts: () => void;
	exportData: () => void;
}

const PRReviewContext = createContext<PRReviewContextValue | undefined>(
	undefined,
);

export function usePRReview() {
	const ctx = useContext(PRReviewContext);
	if (!ctx) throw new Error("usePRReview must be used within PRReviewProvider");
	return ctx;
}

interface ProviderProps {
	value: PRReviewContextValue;
	children: React.ReactNode;
}

export function PRReviewProvider({ value, children }: ProviderProps) {
	return (
		<PRReviewContext.Provider value={value}>
			{children}
		</PRReviewContext.Provider>
	);
}
