"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { toast } from "@/hooks/use-toast";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";

interface UserInfo {
	email: string;
	firstName?: string;
	lastName?: string;
}

export function useConvexPRReviewData(
	user?: UserInfo | null,
	teamSlug?: string,
) {
	const t = useTranslations();

	// Queries - these are automatically reactive and cached
	const reviewers =
		useQuery(api.queries.getReviewers, teamSlug ? { teamSlug } : "skip") ?? [];
	const nextReviewer = useQuery(
		api.queries.getNextReviewer,
		teamSlug ? { teamSlug } : "skip",
	);
	const assignmentFeed = useQuery(
		api.queries.getAssignmentFeed,
		teamSlug ? { teamSlug } : "skip",
	) ?? { items: [], lastAssigned: null };
	const backups =
		useQuery(api.queries.getBackups, teamSlug ? { teamSlug } : "skip") ?? [];

	// Mutations
	const addReviewerMutation = useMutation(api.mutations.addReviewer);
	const updateReviewerMutation = useMutation(api.mutations.updateReviewer);
	const removeReviewerMutation = useMutation(api.mutations.removeReviewer);
	const assignPRMutation = useMutation(api.mutations.assignPR);
	const undoLastAssignmentMutation = useMutation(
		api.mutations.undoLastAssignment,
	);
	const toggleAbsenceMutation = useMutation(
		api.mutations.toggleReviewerAbsence,
	);
	const resetAllCountsMutation = useMutation(api.mutations.resetAllCounts);
	const updateAssignmentCountMutation = useMutation(
		api.mutations.updateAssignmentCount,
	);
	const importReviewersDataMutation = useMutation(
		api.mutations.importReviewersData,
	);
	const initializeDataMutation = useMutation(api.mutations.initializeData);
	const restoreFromBackupMutation = useMutation(
		api.mutations.restoreFromBackup,
	);

	// Initialize data on first load if needed
	const initializeIfNeeded = async () => {
		if (reviewers.length === 0) {
			try {
				if (teamSlug) {
					await initializeDataMutation({ teamSlug });
				}
			} catch (error) {
				console.error("Error initializing data:", error);
			}
		}
	};

	// Data is loading if any of the queries are undefined
	const isLoading =
		reviewers === undefined ||
		nextReviewer === undefined ||
		assignmentFeed === undefined;

	const assignPR = async (opts?: { prUrl?: string }) => {
		if (!nextReviewer) return;

		try {
			await assignPRMutation({
				reviewerId: nextReviewer._id,
				prUrl: opts?.prUrl,
				actionBy: user || undefined,
			});

			toast({
				title: t("data.prAssignedTitle"),
				description: t("data.prAssignedDescription", {
					name: nextReviewer.name,
				}),
			});
		} catch (_error) {
			toast({
				title: t("messages.assignFailedTitle"),
				description: t("messages.assignFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const skipReviewer = async () => {
		if (!nextReviewer) return;

		try {
			await assignPRMutation({
				reviewerId: nextReviewer._id,
				skipped: true,
				actionBy: user || undefined,
			});

			toast({
				title: t("messages.reviewerSkippedTitle"),
				description: t("messages.reviewerSkippedDescription", {
					name: nextReviewer.name,
				}),
			});
		} catch (_error) {
			toast({
				title: t("messages.skipFailedTitle"),
				description: t("messages.skipFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const handleImTheNextOne = async (): Promise<{
		success: boolean;
		nextReviewer?: Doc<"reviewers">;
	}> => {
		if (!nextReviewer) return { success: false };

		// Filter out absent reviewers and the current next reviewer
		const availableReviewers = reviewers.filter(
			(r) => !r.isAbsent && r._id !== nextReviewer._id,
		);

		if (availableReviewers.length === 0) {
			toast({
				title: t("messages.noOtherReviewersTitle"),
				description: t("messages.noOtherReviewersDescription"),
				variant: "destructive",
			});
			return { success: false };
		}

		// Find the minimum assignment count among available reviewers
		const minCount = Math.min(
			...availableReviewers.map((r) => r.assignmentCount),
		);

		// Get all available reviewers with the minimum count
		const candidatesWithMinCount = availableReviewers.filter(
			(r) => r.assignmentCount === minCount,
		);

		// Sort by creation time (older first)
		const sortedCandidates = [...candidatesWithMinCount].sort(
			(a, b) => a.createdAt - b.createdAt,
		);

		const nextAfterSkip = sortedCandidates[0];

		return { success: true, nextReviewer: nextAfterSkip };
	};

	const confirmSkipToNext = async (
		currentNext: Doc<"reviewers">,
		nextAfterSkip: Doc<"reviewers">,
	) => {
		try {
			await assignPRMutation({
				reviewerId: nextAfterSkip._id,
				actionBy: user || undefined,
			});

			toast({
				title: t("data.assignmentCompletedTitle"),
				description: t("data.assignmentCompletedDescription", {
					skippedName: currentNext.name,
					assignedName: nextAfterSkip.name,
				}),
			});
		} catch (_error) {
			toast({
				title: t("data.skipOperationFailedTitle"),
				description: t("data.skipOperationFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const undoAssignment = async () => {
		if (!teamSlug) return;
		try {
			const result = await undoLastAssignmentMutation({ teamSlug });

			if (result.success) {
				toast({
					title: t("data.assignmentUndoneTitle"),
					description: t("data.assignmentUndoneDescription"),
				});
			} else {
				toast({
					title: t("data.undoFailedTitle"),
					description: t("data.undoFailedDescription"),
					variant: "destructive",
				});
			}
		} catch (_error) {
			toast({
				title: t("data.undoFailedTitle"),
				description: t("data.undoFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const addReviewer = async (
		name: string,
		email: string,
		googleChatUserId?: string,
	) => {
		if (!teamSlug) {
			toast({
				title: t("common.error"),
				description: t("messages.missingTeam"),
				variant: "destructive",
			});
			return false;
		}
		if (!name.trim()) {
			toast({
				title: t("data.addReviewerEmptyNameTitle"),
				description: t("data.addReviewerEmptyNameDescription"),
				variant: "destructive",
			});
			return false;
		}

		if (!email.trim()) {
			toast({
				title: t("data.addReviewerEmptyEmailTitle"),
				description: t("data.addReviewerEmptyEmailDescription"),
				variant: "destructive",
			});
			return false;
		}

		try {
			await addReviewerMutation({
				teamSlug,
				name: name.trim(),
				email: email.trim(),
				googleChatUserId: googleChatUserId?.trim() || undefined,
			});

			toast({
				title: t("data.reviewerAddedTitle"),
				description: t("data.reviewerAddedDescription", { name }),
			});
			return true;
		} catch (error) {
			toast({
				title: t("data.addReviewerFailedTitle"),
				description:
					error instanceof Error
						? error.message
						: t("data.addReviewerFailedDescription"),
				variant: "destructive",
			});
			return false;
		}
	};

	const updateReviewer = async (
		id: string,
		name: string,
		email: string,
		googleChatUserId?: string,
	) => {
		if (!name.trim()) {
			toast({
				title: t("data.addReviewerEmptyNameTitle"),
				description: t("data.addReviewerEmptyNameDescription"),
				variant: "destructive",
			});
			return false;
		}

		if (!email.trim()) {
			toast({
				title: t("data.addReviewerEmptyEmailTitle"),
				description: t("data.addReviewerEmptyEmailDescription"),
				variant: "destructive",
			});
			return false;
		}

		try {
			await updateReviewerMutation({
				id: id as Id<"reviewers">,
				name: name.trim(),
				email: email.trim(),
				googleChatUserId: googleChatUserId?.trim() || undefined,
			});

			toast({
				title: t("reviewer.updateSuccess"),
				description: t("reviewer.updateSuccess"),
			});
			return true;
		} catch (error) {
			toast({
				title: t("reviewer.updateFailed"),
				description:
					error instanceof Error ? error.message : t("reviewer.updateFailed"),
				variant: "destructive",
			});
			return false;
		}
	};

	const removeReviewer = async (id: string) => {
		try {
			await removeReviewerMutation({ id: id as Id<"reviewers"> });

			toast({
				title: t("data.reviewerRemovedTitle"),
				description: t("data.reviewerRemovedDescription"),
			});
		} catch (_error) {
			toast({
				title: t("data.removeReviewerFailedTitle"),
				description: t("data.removeReviewerFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const handleToggleAbsence = async (id: string) => {
		try {
			await toggleAbsenceMutation({ id: id as Id<"reviewers"> });
		} catch (_error) {
			toast({
				title: t("messages.statusUpdateFailedTitle"),
				description: t("messages.statusUpdateFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const handleResetCounts = async () => {
		if (confirm(t("messages.resetCountsConfirmation"))) {
			try {
				if (teamSlug) {
					await resetAllCountsMutation({ teamSlug });
				}

				toast({
					title: t("messages.resetCountsSuccessTitle"),
					description: t("messages.resetCountsSuccessDescription"),
				});
			} catch (_error) {
				toast({
					title: t("messages.statusUpdateFailedTitle"),
					description: t("messages.statusUpdateFailedDescription"),
					variant: "destructive",
				});
			}
		}
	};

	const exportData = () => {
		const dataStr = JSON.stringify(reviewers, null, 2);
		const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

		const exportFileDefaultName = `pr-reviewers-${new Date().toISOString().slice(0, 10)}.json`;

		const linkElement = document.createElement("a");
		linkElement.setAttribute("href", dataUri);
		linkElement.setAttribute("download", exportFileDefaultName);
		linkElement.click();
	};

	const importData = async (file: File) => {
		if (!teamSlug) {
			toast({
				title: t("common.error"),
				description: t("messages.missingTeam"),
				variant: "destructive",
			});
			return;
		}
		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const importedData = JSON.parse(e.target?.result as string);
				if (Array.isArray(importedData)) {
					// Ensure all imported reviewers have createdAt
					const dataWithCreatedAt = importedData.map((reviewer) => {
						if (!reviewer.createdAt) {
							return { ...reviewer, createdAt: Date.now() };
						}
						return reviewer;
					});

					await importReviewersDataMutation({
						teamSlug,
						reviewersData: dataWithCreatedAt,
					});

					toast({
						title: t("data.dataImportedTitle"),
						description: t("data.dataImportedDescription"),
					});
				}
			} catch (_error) {
				toast({
					title: t("data.importFormatFailedTitle"),
					description: t("data.importFormatFailedDescription"),
					variant: "destructive",
				});
			}
		};
		reader.readAsText(file);
	};

	const updateAssignmentCount = async (id: string, count: number) => {
		try {
			await updateAssignmentCountMutation({
				id: id as Id<"reviewers">,
				count,
			});
		} catch (_error) {
			toast({
				title: t("messages.statusUpdateFailedTitle"),
				description: t("messages.statusUpdateFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const restoreFromBackup = async (backupId: string): Promise<boolean> => {
		if (!teamSlug) {
			toast({
				title: t("common.error"),
				description: t("messages.missingTeam"),
				variant: "destructive",
			});
			return false;
		}
		try {
			const result = await restoreFromBackupMutation({
				teamSlug,
				backupId: backupId as Id<"backups">,
			});

			if (result.success) {
				toast({
					title: t("common.success"),
					description: t("messages.snapshotRestored"),
				});
				return true;
			} else {
				toast({
					title: t("common.error"),
					description: t("messages.restoreSnapshotFailed"),
					variant: "destructive",
				});
				return false;
			}
		} catch (_error) {
			toast({
				title: t("common.error"),
				description: t("messages.restoreSnapshotFailed"),
				variant: "destructive",
			});
			return false;
		}
	};

	// Initialize data if needed
	if (!isLoading && reviewers.length === 0) {
		initializeIfNeeded();
	}

	return {
		// State
		reviewers,
		nextReviewer,
		isLoading,
		isRefreshing: false, // No more manual refreshing needed with Convex
		assignmentFeed,
		lastUpdated: new Date(), // Always current with Convex
		backups,

		// Actions
		assignPR,
		skipReviewer,
		handleImTheNextOne,
		confirmSkipToNext,
		undoAssignment,
		addReviewer,
		updateReviewer,
		removeReviewer,
		handleToggleAbsence,
		handleResetCounts,
		exportData,
		importData,
		updateAssignmentCount,
		restoreFromBackup,
		handleManualRefresh: () => {}, // No-op since Convex is realtime
		formatLastUpdated: () => "Real-time", // Always real-time with Convex
	};
}
