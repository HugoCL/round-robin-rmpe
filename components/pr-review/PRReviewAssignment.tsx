"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { useConvexPRReviewData } from "@/hooks/useConvexPRReviewData";
import { useConvexTags } from "@/hooks/useConvexTags";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { Assignment, UserInfo } from "@/lib/types";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { ShortcutConfirmationDialog } from "./dialogs/ShortcutConfirmationDialog";
import { SnapshotDialog } from "./dialogs/SnapshotDialog";
import { PageHeader } from "./header/PageHeader";
import { useAssignmentNotificationAudio } from "./hooks/useAssignmentNotificationAudio";
import { useShortcutDialogFlow } from "./hooks/useShortcutDialogFlow";
import { CompactLayout } from "./layouts/CompactLayout";
import { PRReviewProvider } from "./PRReviewContext";
import { PRReviewGuard } from "./PRReviewGuard";

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
	const locale = useLocale();
	const { user, isLoaded } = useUser();
	const { signOut } = useClerk();
	const IMPORT_INPUT_ID = "import-file";

	const [snapshots, setSnapshots] = useState<BackupEntry[]>([]);
	const [snapshotsLoading, setSnapshotsLoading] = useState(false);
	const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
	const [reviewersDrawerOpen, setReviewersDrawerOpen] = useState(false);

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
		alwaysSendGoogleChatMessage,
	} = preferences;

	const {
		reviewers,
		nextReviewer,
		isLoading,
		isRefreshing,
		assignmentFeed: convexAssignmentFeed,
		backups,
		assignPR,
		skipReviewer,
		autoSkipAndAssign,
		undoAssignment,
		addReviewer,
		updateReviewer,
		removeReviewer,
		handleToggleAbsence,
		handleMarkAbsent,
		handleMarkAvailable,
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

	const shortcutFlow = useShortcutDialogFlow({
		assignmentFeed,
		nextReviewer: nextReviewer || null,
		reviewers: reviewers || [],
		teamSlug,
		locale,
		userInfo,
	});

	useKeyboardShortcuts({
		onAssignPR: assignPR,
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
	const toggleAlwaysSendGoogleChatMessage = useCallback(
		() =>
			void updatePreferences({
				alwaysSendGoogleChatMessage: !alwaysSendGoogleChatMessage,
			}),
		[alwaysSendGoogleChatMessage, updatePreferences],
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
			alwaysSendGoogleChatMessage,
			toggleAlwaysSendGoogleChatMessage,
			openSnapshotDialog: handleOpenSnapshotDialog,
			reviewers: reviewers || [],
			nextReviewer: nextReviewer || null,
			assignmentFeed,
			hasTags: !!hasTags,
			userInfo,
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
			updateReviewer,
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
			alwaysSendGoogleChatMessage,
			toggleAlwaysSendGoogleChatMessage,
			handleOpenSnapshotDialog,
			reviewers,
			nextReviewer,
			assignmentFeed,
			hasTags,
			userInfo,
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
			updateReviewer,
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
			userEmail={userInfo?.email}
			onSignOut={async () => {
				await signOut();
			}}
		>
			<PRReviewProvider value={providerValue}>
				<div className="container mx-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
					<div className="page-enter space-y-3">
						<PageHeader
							teamSlug={teamSlug}
							reviewersDrawerOpen={reviewersDrawerOpen}
							setReviewersDrawerOpen={setReviewersDrawerOpen}
						/>
						<AnnouncementBanner />
					</div>
					<CompactLayout />

					<input
						id={IMPORT_INPUT_ID}
						type="file"
						accept=".json"
						title={t("history.import")}
						aria-label={t("history.import")}
						onChange={importFileHandler}
						className="hidden"
					/>

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
						nextReviewerName={nextReviewer?.name}
						currentReviewerName={nextReviewer?.name}
						nextAfterSkipName={undefined}
						lastAssignmentFrom={
							assignmentFeed.items[0]?.actionByName ||
							assignmentFeed.items[0]?.actionByEmail ||
							null
						}
						lastAssignmentTo={assignmentFeed.items[0]?.reviewerName || null}
						onConfirm={() => void shortcutFlow.handleConfirmShortcut()}
						onCancel={shortcutFlow.handleCancelShortcut}
						onOpenChange={(open) => {
							if (!open) shortcutFlow.handleCancelShortcut();
							else shortcutFlow.setShortcutDialogOpen(true);
						}}
						forceSendMessage={alwaysSendGoogleChatMessage}
					/>
				</div>
			</PRReviewProvider>
		</PRReviewGuard>
	);
}
