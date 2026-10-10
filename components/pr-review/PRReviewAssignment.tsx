"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { AgentSetupDialog } from "@/components/settings/AgentSetupDialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { useConvexPRReviewData } from "@/hooks/useConvexPRReviewData";
import { useConvexTags } from "@/hooks/useConvexTags";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { focusPrUrlInput, PR_URL_INPUT_ID } from "@/lib/assignmentFocus";
import type { Assignment, UserInfo } from "@/lib/types";
import { ActiveEventsList } from "./ActiveEventsList";
import { lastAssignmentUndoCopy } from "./assignment/undoCopy";
import { ShortcutConfirmationDialog } from "./dialogs/ShortcutConfirmationDialog";
import { SnapshotDialog } from "./dialogs/SnapshotDialog";
import { PageHeader } from "./header/PageHeader";
import { useAssignmentNotificationAudio } from "./hooks/useAssignmentNotificationAudio";
import { useShortcutDialogFlow } from "./hooks/useShortcutDialogFlow";
import { CompactLayout } from "./layouts/CompactLayout";
import { PRReviewProvider } from "./PRReviewContext";
import { PRReviewGuard } from "./PRReviewGuard";
import { TeamBirthdaySection } from "./TeamBirthdaySection";

interface BackupEntry {
	key: string;
	description: string;
	timestamp: number;
	formattedDate?: string;
}

export default function PRReviewAssignment({
	teamSlug,
}: {
	teamSlug?: string;
}) {
	const t = useTranslations();
	const assignmentHistory = useQuery(
		api.queries.getAssignmentHistory,
		teamSlug ? { teamSlug } : "skip",
	);
	const { user, isLoaded } = useUser();
	const { signOut } = useClerk();
	const IMPORT_INPUT_ID = "import-file";

	const [snapshots, setSnapshots] = useState<BackupEntry[]>([]);
	const [snapshotsLoading, setSnapshotsLoading] = useState(false);
	const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);

	const accessContext = useQuery(
		api.queries.getMyTeamAccess,
		teamSlug ? { teamSlug } : { teamSlug: undefined },
	);

	const { hasTags, refreshTags } = useConvexTags(teamSlug);
	const userInfo: UserInfo | null = user
		? {
				email: user.emailAddresses[0]?.emailAddress || "",
				firstName: user.firstName || undefined,
				lastName: user.lastName || undefined,
				fullName: user.fullName || undefined,
			}
		: null;
	const {
		preferences,
		isReady: isUserPreferencesReady,
		updatePreferences,
	} = useUserPreferences();
	const {
		showAssignments,
		myAssignmentsOnly,
		showTags,
		showEmails,
		hideMultiAssignmentSection,
	} = preferences;

	const {
		reviewers,
		nextReviewer,
		isLoading,
		isRefreshing,
		assignmentFeed: convexAssignmentFeed,
		backups,
		plannedAbsences,
		teamTimezone,
		assignPR,
		skipReviewer,
		autoSkipAndAssign,
		undoAssignment,
		addReviewer,
		updateReviewer,
		setReviewerBirthday: saveReviewerBirthday,
		removeReviewer,
		handleToggleAbsence,
		handleMarkAbsent,
		handleMarkAvailable,
		handleScheduleAbsence,
		handleUpdateAbsence,
		handleCancelAbsence,
		handleSetExcludedFromReviewPool,
		handleResetCounts,
		exportData,
		importData,
		restoreFromBackup,
		handleManualRefresh,
		formatLastUpdated,
	} = useConvexPRReviewData(userInfo, teamSlug);

	const assignmentFeed: Assignment = useMemo(
		() => ({
			items:
				convexAssignmentFeed?.items?.map((item) => ({
					id: `${item.reviewerId}-${item.timestamp}`,
					reviewerId: item.reviewerId,
					reviewerName: item.reviewerName,
					timestamp: item.timestamp,
					batchId: item.batchId,
					isForced: item.forced,
					wasSkipped: item.skipped,
					isAbsentSkip: item.isAbsentSkip,
					urgent: item.urgent === true,
					crossTeamReview: item.crossTeamReview === true,
					source: item.source === "agent" ? "agent" : "ui",
					actionByName: item.actionByName,
					actionByEmail: item.actionByEmail,
					prUrl: item.prUrl,
					tagId: item.tagId,
				})) || [],
			lastAssigned: convexAssignmentFeed?.lastAssigned
				? {
						reviewerId:
							typeof convexAssignmentFeed.lastAssigned === "string"
								? convexAssignmentFeed.lastAssigned
								: "",
						timestamp: Date.now(),
					}
				: null,
		}),
		[convexAssignmentFeed],
	);

	const shortcutFlow = useShortcutDialogFlow();

	useKeyboardShortcuts({
		onSkipReviewer: skipReviewer,
		onUndoAssignment: undoAssignment,
		isNextReviewerAvailable: !!nextReviewer,
		onShortcutTriggered: shortcutFlow.onShortcutTriggered,
	});

	useAssignmentNotificationAudio({
		assignmentItems: convexAssignmentFeed?.items,
		reviewers: reviewers || [],
		userEmail: userInfo?.email,
	});

	const handleDataUpdate = useCallback(async () => {
		await refreshTags();
	}, [refreshTags]);

	const importFileHandler = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;
		await importData(file);
		event.target.value = "";
	};

	const handleOpenSnapshotDialog = useCallback(async () => {
		setSnapshotsLoading(true);
		try {
			const formattedSnapshots: BackupEntry[] = backups.map((backup) => ({
				...backup,
				formattedDate: new Date(backup.timestamp).toLocaleString(),
			}));
			setSnapshots(formattedSnapshots);
		} catch (error) {
			console.error("Error loading snapshots:", error);
			toast({
				title: t("common.error"),
				description: t("messages.loadSnapshotsFailed"),
				variant: "destructive",
			});
		} finally {
			setSnapshotsLoading(false);
		}
		setSnapshotDialogOpen(true);
	}, [backups, t]);

	const handleRestoreSnapshot = async (key: string) => {
		try {
			const success = await restoreFromBackup(key);
			if (success) {
				setSnapshotDialogOpen(false);
			}
		} catch (error) {
			console.error("Error restoring snapshot:", error);
			toast({
				title: t("common.error"),
				description: t("messages.restoreSnapshotFailed"),
				variant: "destructive",
			});
		}
	};

	const toggleShowAssignments = useCallback(
		() => void updatePreferences({ showAssignments: !showAssignments }),
		[showAssignments, updatePreferences],
	);
	const toggleMyAssignmentsOnly = useCallback(
		() =>
			void updatePreferences({
				myAssignmentsOnly: !myAssignmentsOnly,
			}),
		[myAssignmentsOnly, updatePreferences],
	);
	const toggleShowTags = useCallback(
		() => void updatePreferences({ showTags: !showTags }),
		[showTags, updatePreferences],
	);
	const toggleShowEmails = useCallback(
		() => void updatePreferences({ showEmails: !showEmails }),
		[showEmails, updatePreferences],
	);
	const toggleHideMultiAssignmentSection = useCallback(
		() =>
			void updatePreferences({
				hideMultiAssignmentSection: !hideMultiAssignmentSection,
			}),
		[hideMultiAssignmentSection, updatePreferences],
	);
	const providerValue = useMemo(
		() => ({
			teamSlug,
			isAdmin: accessContext?.isAdmin === true,
			isForeignTeamView: accessContext?.isForeignTeam === true,
			canManageCurrentTeam: accessContext?.canManageCurrentTeam === true,
			showAssignments,
			toggleShowAssignments,
			myAssignmentsOnly,
			toggleMyAssignmentsOnly,
			showTags,
			toggleShowTags,
			showEmails,
			toggleShowEmails,
			hideMultiAssignmentSection,
			toggleHideMultiAssignmentSection,
			openSnapshotDialog: handleOpenSnapshotDialog,
			reviewers: reviewers || [],
			nextReviewer: nextReviewer || null,
			assignmentFeed,
			hasTags: !!hasTags,
			userInfo,
			plannedAbsences,
			teamTimezone,
			isRefreshing: !!isRefreshing,
			formatLastUpdated,
			handleManualRefresh,
			onDataUpdate: handleDataUpdate,
			assignPR,
			skipReviewer,
			undoAssignment,
			autoSkipAndAssign,
			onToggleAbsence: handleToggleAbsence,
			onMarkAbsent: handleMarkAbsent,
			onMarkAvailable: handleMarkAvailable,
			onScheduleAbsence: handleScheduleAbsence,
			onUpdateAbsence: handleUpdateAbsence,
			onCancelAbsence: handleCancelAbsence,
			onSetExcludedFromReviewPool: handleSetExcludedFromReviewPool,
			updateReviewer,
			setReviewerBirthday: (
				reviewerId: Id<"reviewers">,
				month: number,
				day: number,
			) => saveReviewerBirthday(reviewerId, month, day),
			addReviewer,
			removeReviewer,
			handleResetCounts,
			exportData,
		}),
		[
			teamSlug,
			accessContext,
			showAssignments,
			toggleShowAssignments,
			myAssignmentsOnly,
			toggleMyAssignmentsOnly,
			showTags,
			toggleShowTags,
			showEmails,
			toggleShowEmails,
			hideMultiAssignmentSection,
			toggleHideMultiAssignmentSection,
			handleOpenSnapshotDialog,
			reviewers,
			nextReviewer,
			assignmentFeed,
			hasTags,
			userInfo,
			plannedAbsences,
			teamTimezone,
			isRefreshing,
			formatLastUpdated,
			handleManualRefresh,
			handleDataUpdate,
			assignPR,
			skipReviewer,
			undoAssignment,
			autoSkipAndAssign,
			handleToggleAbsence,
			handleMarkAbsent,
			handleMarkAvailable,
			handleScheduleAbsence,
			handleUpdateAbsence,
			handleCancelAbsence,
			handleSetExcludedFromReviewPool,
			updateReviewer,
			saveReviewerBirthday,
			addReviewer,
			removeReviewer,
			handleResetCounts,
			exportData,
		],
	);

	return (
		<PRReviewGuard
			isLoading={isLoading}
			isLoaded={isLoaded}
			isUserPreferencesReady={isUserPreferencesReady}
			hasAccessContext={!!accessContext}
			isAuthenticated={!!user}
			// The server checks the primary address, which need not be the first one.
			userEmail={user?.primaryEmailAddress?.emailAddress ?? userInfo?.email}
			onSignOut={async () => {
				await signOut();
			}}
		>
			<PRReviewProvider value={providerValue}>
				<div className="flex min-h-dvh flex-col">
					{accessContext?.isForeignTeam === true ? null : (
						<a
							href={`#${PR_URL_INPUT_ID}`}
							onClick={(event) => {
								if (focusPrUrlInput()) event.preventDefault();
							}}
							className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
						>
							{t("shortcuts.focusPrUrl")}
						</a>
					)}
					<PageHeader teamSlug={teamSlug} />
					<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 pb-4 sm:px-6 lg:pb-6">
						<div
							className="notice-stack page-enter mt-3 sm:mt-5 lg:mt-6"
							role="region"
							aria-label={t("common.notices")}
						>
							<ActiveEventsList />
							<TeamBirthdaySection teamSlug={teamSlug} />
						</div>
						<CompactLayout />
					</main>

					<input
						id={IMPORT_INPUT_ID}
						type="file"
						accept=".json"
						title={t("history.import")}
						aria-label={t("history.import")}
						onChange={importFileHandler}
						className="hidden"
					/>

					<AgentSetupDialog />
					<SnapshotDialog
						isOpen={snapshotDialogOpen}
						onOpenChange={setSnapshotDialogOpen}
						snapshots={snapshots}
						isLoading={snapshotsLoading}
						onRestore={handleRestoreSnapshot}
					/>

					<ShortcutConfirmationDialog
						isOpen={shortcutFlow.shortcutDialogOpen}
						action={shortcutFlow.pendingShortcut}
						currentReviewerName={nextReviewer?.name}
						isSelfNext={
							!!userInfo?.email &&
							nextReviewer?.email.toLowerCase() === userInfo.email.toLowerCase()
						}
						undoCopy={lastAssignmentUndoCopy(
							t,
							assignmentFeed.items,
							assignmentHistory,
						)}
						onConfirm={() => void shortcutFlow.handleConfirmShortcut()}
						onCancel={shortcutFlow.handleCancelShortcut}
						onOpenChange={(open) => {
							if (!open) shortcutFlow.handleCancelShortcut();
							else shortcutFlow.setShortcutDialogOpen(true);
						}}
					/>
				</div>
			</PRReviewProvider>
		</PRReviewGuard>
	);
}
