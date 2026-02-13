"use client";

import { createContext, useContext } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Assignment, Reviewer, UserInfo } from "@/lib/types";

export interface PRReviewContextValue {
	teamSlug?: string;
	// Visibility / layout
	showAssignments: boolean;
	toggleShowAssignments: () => void;
	showTags: boolean;
	toggleShowTags: () => void;
	showEmails: boolean;
	toggleShowEmails: () => void;
	openSnapshotDialog: () => void;

	// Data
	reviewers: Reviewer[];
	nextReviewer: Reviewer | null;
	assignmentFeed: Assignment;
	hasTags: boolean;
	userInfo: UserInfo | null;

	// Loading / refresh
	isRefreshing: boolean;
	formatLastUpdated: () => string;
	handleManualRefresh: () => Promise<void>;
	onDataUpdate: () => Promise<void>;

	// Reviewer actions
	assignPR: (opts?: { prUrl?: string; contextUrl?: string }) => Promise<void>;
	undoAssignment: () => Promise<void>;
	autoSkipAndAssign: (opts?: {
		prUrl?: string;
		contextUrl?: string;
	}) => Promise<void>;
	onToggleAbsence: (id: Id<"reviewers">) => Promise<void>;
	onMarkAbsent: (id: Id<"reviewers">, absentUntil?: number) => Promise<void>;
	onMarkAvailable: (id: Id<"reviewers">) => Promise<void>;
	updateReviewer: (
		id: Id<"reviewers">,
		name: string,
		email: string,
		googleChatUserId?: string,
	) => Promise<boolean>;
	addReviewer: (
		name: string,
		email: string,
		googleChatUserId?: string,
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
