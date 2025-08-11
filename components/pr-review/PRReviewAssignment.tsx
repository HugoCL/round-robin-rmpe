"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useConvexPRReviewData } from "@/hooks/useConvexPRReviewData";
import { useConvexTags } from "@/hooks/useConvexTags";
import { Button } from "@/components/ui/button";
import { PageHeader } from "./header/PageHeader";
import { CompactLayout } from "./layouts/CompactLayout";
import { ClassicLayout } from "./layouts/ClassicLayout";
import { SnapshotDialog } from "./dialogs/SnapshotDialog";
import { SkipConfirmationDialog } from "./dialogs/SkipConfirmationDialog";
import type { Doc } from "@/convex/_generated/dataModel";
import type { UserInfo, Assignment } from "@/lib/types";

// Define the structure for a backup entry
interface BackupEntry {
	key: string;
	description: string;
	timestamp: number;
	formattedDate?: string;
}

/**
 * PRReviewAssignment is the main component for the PR review assignment tool.
 * It acts as a container, fetching data, managing state, and composing the UI
 * from smaller components like layouts, dialogs, and headers.
 *
 * @param {object} props - The component props.
 * @param {string} [props.teamSlug] - The slug of the team currently being viewed.
 */
export default function PRReviewAssignment({
	teamSlug,
}: {
	teamSlug?: string;
}) {
	const t = useTranslations();
	const { user, isLoaded } = useUser();
	const { signOut } = useClerk();

	// State for managing UI preferences and dialogs
	const [snapshots, setSnapshots] = useState<BackupEntry[]>([]);
	const [snapshotsLoading, setSnapshotsLoading] = useState(false);
	const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
	const [showAssignments, setShowAssignments] = useState(false);
	const [showTags, setShowTags] = useState(true);
	const [showEmails, setShowEmails] = useState(false);
	const [skipConfirmDialogOpen, setSkipConfirmDialogOpen] = useState(false);
	const [nextAfterSkip, setNextAfterSkip] = useState<Doc<"reviewers"> | null>(
		null,
	);
	const [compactLayout, setCompactLayout] = useState(false);
	const [reviewersDrawerOpen, setReviewersDrawerOpen] = useState(false);

	// Custom hooks for data fetching and business logic
	const { hasTags, refreshTags } = useConvexTags(teamSlug);
	const userInfo: UserInfo | null = user
		? {
				email: user.emailAddresses[0]?.emailAddress || "",
				firstName: user.firstName || undefined,
				lastName: user.lastName || undefined,
			}
		: null;

	const {
		reviewers,
		nextReviewer,
		isLoading,
		isRefreshing,
		assignmentFeed: convexAssignmentFeed,
		backups,
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
		restoreFromBackup,
		handleManualRefresh,
		formatLastUpdated,
	} = useConvexPRReviewData(userInfo, teamSlug);

	// Enable keyboard shortcuts for common actions
	useKeyboardShortcuts({
		onAssignPR: assignPR,
		onSkipReviewer: skipReviewer,
		onUndoAssignment: undoAssignment,
		onRefresh: handleManualRefresh,
		isNextReviewerAvailable: !!nextReviewer,
	});

	// Load user preferences from localStorage on component mount
	useEffect(() => {
		const savedShowAssignments = localStorage.getItem("showAssignments");
		if (savedShowAssignments !== null) {
			setShowAssignments(savedShowAssignments === "true");
		}

		const savedShowTags = localStorage.getItem("showTags");
		if (savedShowTags !== null) {
			setShowTags(savedShowTags === "true");
		}

		const savedCompactLayout = localStorage.getItem("compactLayout");
		if (savedCompactLayout !== null) {
			setCompactLayout(savedCompactLayout === "true");
		}

		const savedShowEmails = localStorage.getItem("showEmails");
		if (savedShowEmails !== null) {
			setShowEmails(savedShowEmails === "true");
		}
	}, []);

	// Save user preferences to localStorage whenever they change
	useEffect(() => {
		localStorage.setItem("showAssignments", showAssignments.toString());
	}, [showAssignments]);

	useEffect(() => {
		localStorage.setItem("showTags", showTags.toString());
	}, [showTags]);

	useEffect(() => {
		localStorage.setItem("compactLayout", compactLayout.toString());
	}, [compactLayout]);

	useEffect(() => {
		localStorage.setItem("showEmails", showEmails.toString());
	}, [showEmails]);

	// Transform assignment feed data for child components
	const assignmentFeed: Assignment = {
		items:
			convexAssignmentFeed?.items?.map((item) => ({
				id: `${item.reviewerId}-${item.timestamp}`,
				reviewerId: item.reviewerId,
				reviewerName: item.reviewerName,
				timestamp: item.timestamp,
				isForced: item.forced,
				wasSkipped: item.skipped,
				isAbsentSkip: item.isAbsentSkip,
				actionBy: item.actionBy,
				tagId: item.tagId,
			})) || [],
		lastAssigned: convexAssignmentFeed?.lastAssigned || null,
	};

	const handleDataUpdate = async () => {
		await refreshTags();
	};

	// Opens the skip confirmation dialog
	const handleImTheNextOneWithDialog = async () => {
		const result = await handleImTheNextOne();
		if (result.success && result.nextReviewer) {
			setNextAfterSkip(result.nextReviewer);
			setSkipConfirmDialogOpen(true);
		}
	};

	// Confirms the skip action
	const handleConfirmSkipToNext = async () => {
		if (!nextReviewer || !nextAfterSkip) return;
		await confirmSkipToNext(nextReviewer, nextAfterSkip);
		setSkipConfirmDialogOpen(false);
		setNextAfterSkip(null);
	};

	// Cancels the skip action
	const handleCancelSkip = () => {
		setSkipConfirmDialogOpen(false);
		setNextAfterSkip(null);
	};

	// Handles file import for data recovery
	const importFileHandler = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;
		await importData(file);
		event.target.value = ""; // Reset input
	};

	// Loads snapshots from backups
	const loadSnapshots = async () => {
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
	};

	// Opens the snapshot dialog
	const handleOpenSnapshotDialog = () => {
		loadSnapshots();
		setSnapshotDialogOpen(true);
	};

	// Restores data from a selected snapshot
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

	// Toggles for various UI preferences
	const toggleShowAssignments = () => setShowAssignments((p) => !p);
	const toggleShowTags = () => setShowTags((p) => !p);
	const toggleCompactLayout = () => setCompactLayout((p) => !p);
	const toggleShowEmails = () => setShowEmails((p) => !p);

	// Render loading state
	if (isLoading || !isLoaded) {
		return (
			<div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
				<div className="text-center">
					<h2 className="text-xl font-semibold mb-2">{t("common.loading")}</h2>
					<p className="text-muted-foreground">{t("pr.loadingPleaseWait")}</p>
				</div>
			</div>
		);
	}

	// Render not authenticated state
	if (!user) {
		return (
			<div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
				<div className="text-center">
					<h2 className="text-xl font-semibold mb-2">
						{t("you-are-not-authenticated")}
					</h2>
					<p className="text-muted-foreground">{t("pr.pleaseSignIn")}</p>
				</div>
			</div>
		);
	}

	// Render not authorized state for non-company emails
	if (userInfo && !/^.+@buk\.[a-zA-Z0-9-]+$/.test(userInfo.email)) {
		return (
			<div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
				<div className="text-center">
					<h2 className="text-xl font-semibold mb-2">
						{t("pr.notAuthorizedTitle")}
					</h2>
					<p className="text-muted-foreground">
						{t("pr.notAuthorizedDescription")} {t("pr.unauthorized")}{" "}
						{userInfo?.email}
					</p>
					<form
						action={async () => {
							await signOut();
						}}
					>
						<Button type="submit">{t("pr.signOut")}</Button>
					</form>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 ">
			<PageHeader
				teamSlug={teamSlug}
				compactLayout={compactLayout}
				showAssignments={showAssignments}
				showTags={showTags}
				showEmails={showEmails}
				isRefreshing={isRefreshing}
				reviewers={reviewers}
				nextReviewer={nextReviewer}
				assignmentFeed={{ lastAssigned: assignmentFeed.lastAssigned ?? undefined }}
				reviewersDrawerOpen={reviewersDrawerOpen}
				onToggleCompactLayout={toggleCompactLayout}
				onToggleShowAssignments={toggleShowAssignments}
				onToggleShowTags={toggleShowTags}
				onToggleShowEmails={toggleShowEmails}
				onOpenSnapshotDialog={handleOpenSnapshotDialog}
				onManualRefresh={handleManualRefresh}
				formatLastUpdated={formatLastUpdated}
				setReviewersDrawerOpen={setReviewersDrawerOpen}
				onToggleAbsence={handleToggleAbsence}
				onDataUpdate={handleDataUpdate}
				updateReviewer={updateReviewer}
				addReviewer={addReviewer}
				removeReviewer={removeReviewer}
				handleResetCounts={handleResetCounts}
				exportData={exportData}
			/>

			{compactLayout ? (
				<CompactLayout
					reviewers={reviewers}
					nextReviewer={nextReviewer}
					assignmentFeed={assignmentFeed}
					hasTags={hasTags}
					userInfo={userInfo}
					teamSlug={teamSlug}
					onDataUpdate={handleDataUpdate}
					assignPR={assignPR}
					undoAssignment={undoAssignment}
					handleImTheNextOneWithDialog={handleImTheNextOneWithDialog}
				/>
			) : (
				<ClassicLayout
					reviewers={reviewers}
					nextReviewer={nextReviewer}
					assignmentFeed={assignmentFeed}
					showAssignments={showAssignments}
					showTags={showTags}
					showEmails={showEmails}
					hasTags={hasTags}
					userInfo={userInfo}
					teamSlug={teamSlug}
					onToggleAbsence={handleToggleAbsence}
					onDataUpdate={handleDataUpdate}
					updateReviewer={updateReviewer}
					addReviewer={addReviewer}
					removeReviewer={removeReviewer}
					handleResetCounts={handleResetCounts}
					exportData={exportData}
					assignPR={assignPR}
					undoAssignment={undoAssignment}
					handleImTheNextOneWithDialog={handleImTheNextOneWithDialog}
				/>
			)}

			{/* Hidden input for import functionality */}
			<input
				id="import-file"
				type="file"
				accept=".json"
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

			<SkipConfirmationDialog
				isOpen={skipConfirmDialogOpen}
				onOpenChange={setSkipConfirmDialogOpen}
				nextReviewer={nextReviewer ?? null}
				nextAfterSkip={nextAfterSkip}
				onConfirm={handleConfirmSkipToNext}
				onCancel={handleCancelSkip}
			/>
		</div>
	);
}
