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
	name?: string;
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
				title: "Error",
				description: "Failed to refresh data from database",
				variant: "destructive",
			});
		} finally {
			if (showLoadingState) {
				setIsRefreshing(false);
			}
		}
	}, []);

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
					title: "Error",
					description: "Failed to load data from database",
					variant: "destructive",
				});
				setIsLoading(false);
			}
		}

		loadInitialData();
	}, []);

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

		// Find the minimum assignment count among all reviewers
		const minCount = Math.min(...reviewers.map((r) => r.assignmentCount));

		// Get all reviewers with the minimum count
		const candidatesWithMinCount = reviewers.filter(
			(r) => r.assignmentCount === minCount,
		);

		// Sort by creation time (older first)
		const sortedCandidates = [...candidatesWithMinCount].sort(
			(a, b) => a.createdAt - b.createdAt,
		);

		// Check if the first candidate is absent
		if (sortedCandidates.length > 0) {
			const firstCandidate = sortedCandidates[0];

			if (firstCandidate.isAbsent) {
				// Increment the counter for the absent reviewer, but mark it as an absent skip
				const success = await incrementReviewerCount(
					firstCandidate.id,
					true,
					true,
				);

				if (success) {
					// Refresh data and find next reviewer again
					await fetchData();
					// This will trigger useEffect which will call findNextReviewer again					} else {
					toast({
						title: t("messages.statusUpdateFailedTitle"),
						description: t("messages.skipAbsentFailedDescription"),
						variant: "destructive",
					});
				}
			} else {
				// If not absent, set as next reviewer
				setNextReviewer(firstCandidate);
			}
		} else {
			setNextReviewer(null);
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
				title: "PR Assigned",
				description: `PR assigned to ${nextReviewer.name}`,
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
				title: "Assignment Completed",
				description: `${currentNext.name} was skipped and PR assigned to ${nextAfterSkip.name}.`,
			});
		} else {
			toast({
				title: "Error",
				description: "Failed to complete the skip operation. Please try again.",
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
				title: "Assignment Undone",
				description: "The last PR assignment has been undone",
			});
		} else {
			toast({
				title: "Error",
				description: "No assignments to undo or operation failed",
				variant: "destructive",
			});
		}
	};

	const addReviewer = async (name: string) => {
		if (!name.trim()) {
			toast({
				title: "Error",
				description: "Please enter a name for the new reviewer",
				variant: "destructive",
			});
			return false;
		}

		// Add to Redis
		const success = await addReviewerAction(name.trim());

		if (success) {
			// Refresh data to get updated reviewers
			await fetchData();

			toast({
				title: "Reviewer Added",
				description: `${name} has been added to the rotation`,
			});
			return true;
		} else {
			toast({
				title: "Error",
				description: "Failed to add reviewer. Please try again.",
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
				title: "Reviewer Removed",
				description: "Reviewer has been removed from the rotation",
			});
		} else {
			toast({
				title: "Error",
				description: "Failed to remove reviewer. Please try again.",
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
							title: "Data Imported",
							description: "Reviewer data has been successfully imported",
						});
					} else {
						toast({
							title: "Import Error",
							description: "Failed to save imported data to database",
							variant: "destructive",
						});
					}
				}
			} catch {
				toast({
					title: "Import Error",
					description: "Failed to import data. Please check the file format.",
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
