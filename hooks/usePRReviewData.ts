"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
	type AssignmentFeed,
	addReviewer as addReviewerAction,
	getAssignmentFeed,
	getReviewers,
	incrementReviewerCount,
	type Reviewer,
	removeReviewer as removeReviewerAction,
	resetAllCounts,
	saveReviewers,
	skipToNextReviewer as skipToNextReviewerAction,
	toggleAbsence,
	undoLastAssignment,
} from "@/app/[locale]/actions";
import { toast } from "@/hooks/use-toast";

const UPDATE_INTERVAL = 60000; // 1 minute in milliseconds

interface UserInfo {
	email: string;
	firstName?: string;
	lastName?: string;
}

export function usePRReviewData(user?: UserInfo | null) {
	const t = useTranslations();
	const [reviewers, setReviewers] = useState<Reviewer[]>([]);
	const [nextReviewer, setNextReviewer] = useState<Reviewer | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [assignmentFeed, setAssignmentFeed] = useState<AssignmentFeed>({
		items: [],
		lastAssigned: null,
	});
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	// Function to fetch reviewers data and assignment feed
	const fetchData = useCallback(async (showLoadingState = false) => {
		if (showLoadingState) {
			setIsRefreshing(true);
		}

		try {
			const [reviewersData, feedData] = await Promise.all([
				getReviewers(),
				getAssignmentFeed(),
			]);

			setReviewers(reviewersData);
			setAssignmentFeed(feedData);
			setLastUpdated(new Date());
		} catch (error) {
			console.error("Error loading data:", error);
			toast({
				title: t("data.refreshFailedTitle"),
				description: t("data.refreshFailedDescription"),
				variant: "destructive",
			});
		} finally {
			if (showLoadingState) {
				setIsRefreshing(false);
			}
		}
	}, [t]);

	// Load reviewers from Redis on initial load
	useEffect(() => {
		async function loadInitialData() {
			try {
				const [reviewersData, feedData] = await Promise.all([
					getReviewers(),
					getAssignmentFeed(),
				]);

				setReviewers(reviewersData);
				setAssignmentFeed(feedData);
				setLastUpdated(new Date());
				setIsLoading(false);
			} catch (error) {
				console.error("Error loading initial data:", error);
				toast({
					title: t("data.loadFailedTitle"),
					description: t("data.loadFailedDescription"),
					variant: "destructive",
				});
				setIsLoading(false);
			}
		}

		loadInitialData();
	}, [t]);

	// Set up interval for periodic updates
	useEffect(() => {
		// Only set up the interval once the initial data is loaded
		if (isLoading) return;

		// Set up interval to fetch data every minute
		intervalRef.current = setInterval(() => {
			fetchData();
		}, UPDATE_INTERVAL);

		// Clean up on unmount
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [isLoading, fetchData]);

	// Handle visibility change to pause/resume updates when tab is hidden
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				// Refresh data immediately when tab becomes visible
				fetchData();

				// Restart the interval
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
				}

				intervalRef.current = setInterval(() => {
					fetchData();
				}, UPDATE_INTERVAL);
			} else {
				// Clear interval when tab is hidden
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
			}
		};

		// Add event listener
		document.addEventListener("visibilitychange", handleVisibilityChange);

		// Clean up
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [fetchData]);

	const findNextReviewer = useCallback(async () => {
		// Get all reviewers (including absent ones)
		if (reviewers.length === 0) {
			setNextReviewer(null);
			return;
		}

		// Find available reviewers (not absent) first
		const availableReviewers = reviewers.filter((r) => !r.isAbsent);

		if (availableReviewers.length > 0) {
			// Find the minimum assignment count among available reviewers
			const minCount = Math.min(...availableReviewers.map((r) => r.assignmentCount));

			// Get all available reviewers with the minimum count
			const candidatesWithMinCount = availableReviewers.filter(
				(r) => r.assignmentCount === minCount,
			);

			// Sort by creation time (older first)
			const sortedCandidates = [...candidatesWithMinCount].sort(
				(a, b) => a.createdAt - b.createdAt,
			);

			// Set the first available candidate as next reviewer
			setNextReviewer(sortedCandidates[0]);
		} else {
			// All reviewers are absent - handle this case by auto-skipping the first one
			// but only if we haven't already tried to skip them in this cycle
			const minCount = Math.min(...reviewers.map((r) => r.assignmentCount));
			const candidatesWithMinCount = reviewers.filter(
				(r) => r.assignmentCount === minCount,
			);

			const sortedCandidates = [...candidatesWithMinCount].sort(
				(a, b) => a.createdAt - b.createdAt,
			);

			if (sortedCandidates.length > 0) {
				const firstCandidate = sortedCandidates[0];

				// Check if this reviewer should be auto-skipped
				// We'll skip them and increment their count, but only show an error if it fails
				try {
					const success = await incrementReviewerCount(
						firstCandidate.id,
						true,
						true,
					);

					if (success) {
						// Refresh data which will trigger this function again to find the next available reviewer
						await fetchData();
					} else {
						// Show error and set the absent reviewer anyway so the UI doesn't break
						toast({
							title: t("messages.statusUpdateFailedTitle"),
							description: t("messages.skipAbsentFailedDescription"),
							variant: "destructive",
						});
						setNextReviewer(firstCandidate);
					}
				} catch (error) {
					console.error("Error auto-skipping absent reviewer:", error);
					toast({
						title: t("messages.statusUpdateFailedTitle"),
						description: t("messages.skipAbsentFailedDescription"),
						variant: "destructive",
					});
					// Set the absent reviewer anyway so the UI doesn't break
					setNextReviewer(firstCandidate);
				}
			} else {
				setNextReviewer(null);
			}
		}
	}, [reviewers, fetchData, t]);

	// Find the next reviewer whenever the reviewers list changes
	useEffect(() => {
		if (reviewers.length > 0) {
			findNextReviewer();
		}
	}, [reviewers, findNextReviewer]);

	const assignPR = async () => {
		if (!nextReviewer) return;

		// Increment the counter in Redis
		const success = await incrementReviewerCount(nextReviewer.id, false, false, user || undefined);

		if (success) {
			// Refresh data to get updated reviewers and feed
			await fetchData();

			toast({
				title: t("data.prAssignedTitle"),
				description: t("data.prAssignedDescription", { name: nextReviewer.name }),
			});
		} else {
			toast({
				title: t("messages.assignFailedTitle"),
				description: t("messages.assignFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const skipReviewer = async () => {
		if (!nextReviewer) return;

		// Increment the counter in Redis with skipped flag
		const success = await incrementReviewerCount(nextReviewer.id, true, false, user || undefined);

		if (success) {
			// Refresh data to get updated reviewers and feed
			await fetchData();

			toast({
				title: t("messages.reviewerSkippedTitle"),
				description: t("messages.reviewerSkippedDescription", { name: nextReviewer.name }),
			});
		} else {
			toast({
				title: t("messages.skipFailedTitle"),
				description: t("messages.skipFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const handleImTheNextOne = async (): Promise<{
		success: boolean;
		nextReviewer?: Reviewer;
	}> => {
		if (!nextReviewer) return { success: false };

		// Find the next reviewer that's not the current next one
		const result = await skipToNextReviewerAction(nextReviewer.id);

		if (result.success && result.nextReviewer) {
			return { success: true, nextReviewer: result.nextReviewer };
		} else {
			toast({
				title: t("messages.noOtherReviewersTitle"),
				description: t("messages.noOtherReviewersDescription"),
				variant: "destructive",
			});
			return { success: false };
		}
	};

	const confirmSkipToNext = async (
		currentNext: Reviewer,
		nextAfterSkip: Reviewer,
	) => {
		// Increment only the reviewer who is actually getting the assignment (nextAfterSkip)
		// The currentNext reviewer is being skipped, so they shouldn't get their counter incremented
		const success = await incrementReviewerCount(nextAfterSkip.id, false, false, user || undefined);

		if (success) {
			// Refresh data which will automatically find the new next reviewer
			await fetchData();

			toast({
				title: t("data.assignmentCompletedTitle"),
				description: t("data.assignmentCompletedDescription", {
					skippedName: currentNext.name,
					assignedName: nextAfterSkip.name
				}),
			});
		} else {
			toast({
				title: t("data.skipOperationFailedTitle"),
				description: t("data.skipOperationFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const undoAssignment = async () => {
		const result = await undoLastAssignment();

		if (result.success && result.reviewerId) {
			// Refresh data to get updated reviewers and feed
			await fetchData();

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
	};

	const addReviewer = async (name: string, email: string) => {
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

		// Add to Redis
		const success = await addReviewerAction(name.trim(), email.trim());

		if (success) {
			// Refresh data to get updated reviewers
			await fetchData();

			toast({
				title: t("data.reviewerAddedTitle"),
				description: t("data.reviewerAddedDescription", { name }),
			});
			return true;
		} else {
			toast({
				title: t("data.addReviewerFailedTitle"),
				description: t("data.addReviewerFailedDescription"),
				variant: "destructive",
			});
			return false;
		}
	};

	const removeReviewer = async (id: string) => {
		// Remove from Redis
		const success = await removeReviewerAction(id);

		if (success) {
			// Refresh data to get updated reviewers
			await fetchData();

			toast({
				title: t("data.reviewerRemovedTitle"),
				description: t("data.reviewerRemovedDescription"),
			});
		} else {
			toast({
				title: t("data.removeReviewerFailedTitle"),
				description: t("data.removeReviewerFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const handleToggleAbsence = async (id: string) => {
		// Toggle in Redis
		const success = await toggleAbsence(id);

		if (success) {
			// Refresh data to get updated reviewers
			await fetchData();
		} else {
			toast({
				title: t("messages.statusUpdateFailedTitle"),
				description: t("messages.statusUpdateFailedDescription"),
				variant: "destructive",
			});
		}
	};

	const handleResetCounts = async () => {
		if (
			confirm(t("messages.resetCountsConfirmation"))
		) {
			// Reset in Redis
			const success = await resetAllCounts();

			if (success) {
				// Refresh data to get updated reviewers
				await fetchData();

				toast({
					title: t("messages.resetCountsSuccessTitle"),
					description: t("messages.resetCountsSuccessDescription"),
				});
			} else {
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

					// Save to Redis
					const success = await saveReviewers(dataWithCreatedAt);

					if (success) {
						// Refresh data to get updated reviewers
						await fetchData();

						toast({
							title: t("data.dataImportedTitle"),
							description: t("data.dataImportedDescription"),
						});
					} else {
						toast({
							title: t("data.importSaveFailedTitle"),
							description: t("data.importSaveFailedDescription"),
							variant: "destructive",
						});
					}
				}
			} catch {
				toast({
					title: t("data.importFormatFailedTitle"),
					description: t("data.importFormatFailedDescription"),
					variant: "destructive",
				});
			}
		};
		reader.readAsText(file);
	};

	const handleManualRefresh = () => {
		fetchData(true);
	};

	// Format the last updated time
	const formatLastUpdated = () => {
		return lastUpdated.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return {
		// State
		reviewers,
		nextReviewer,
		isLoading,
		isRefreshing,
		assignmentFeed,
		lastUpdated,

		// Actions
		assignPR,
		skipReviewer,
		handleImTheNextOne,
		confirmSkipToNext,
		undoAssignment,
		addReviewer,
		removeReviewer,
		handleToggleAbsence,
		handleResetCounts,
		exportData,
		importData,
		fetchData,
		handleManualRefresh,
		formatLastUpdated,
	};
}
