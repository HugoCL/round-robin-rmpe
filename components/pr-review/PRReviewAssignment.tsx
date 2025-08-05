"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
	Download,
	Menu,
	MoreHorizontal,
	RotateCw,
	Save,
	UserMinus,
	UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Reviewer } from "@/app/[locale]/actions";
import {
	type BackupEntry,
	getSnapshots,
	restoreFromSnapshot,
} from "@/app/[locale]/backup-actions";
import { AssignmentCard } from "@/components/pr-review/AssignmentCard";
import { AddReviewerDialog } from "@/components/pr-review/AddReviewerDialog";
import { DeleteReviewerDialog } from "@/components/pr-review/DeleteReviewerDialog";
import { ForceAssignDialog } from "@/components/pr-review/ForceAssignDialog";
import { HeaderOptionsDrawer } from "@/components/pr-review/HeaderOptionsDrawer";
import { RecentAssignments } from "@/components/pr-review/RecentAssignments";
import { ReviewersTable } from "@/components/pr-review/ReviewersTable";
import { SkipConfirmationDialog } from "@/components/pr-review/SkipConfirmationDialog";
import { FeedHistory } from "@/components/pr-review/FeedHistory";
import { TagManager } from "@/components/pr-review/TagManager";
import { TrackBasedAssignment } from "@/components/pr-review/TrackBasedAssignment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePRReviewData } from "@/hooks/usePRReviewData";
import { useTags } from "@/hooks/useTags";

export default function PRReviewAssignment() {
	const t = useTranslations();
	const [snapshots, setSnapshots] = useState<BackupEntry[]>([]);
	const [snapshotsLoading, setSnapshotsLoading] = useState(false);
	const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
	const [showAssignments, setShowAssignments] = useState(false);
	const [showTags, setShowTags] = useState(true);
	const [showEmails, setShowEmails] = useState(false);
	const [skipConfirmDialogOpen, setSkipConfirmDialogOpen] = useState(false);
	const [nextAfterSkip, setNextAfterSkip] = useState<Reviewer | null>(null);
	const [compactLayout, setCompactLayout] = useState(false);
	const [reviewersDrawerOpen, setReviewersDrawerOpen] = useState(false);

	const { user, isLoaded } = useUser();
	const { signOut } = useClerk();
	const { hasTags, refreshTags } = useTags();

	const userInfo = user
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
		assignmentFeed,
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
		fetchData,
		handleManualRefresh,
		formatLastUpdated,
	} = usePRReviewData(userInfo);

	// Enable keyboard shortcuts
	useKeyboardShortcuts({
		onAssignPR: assignPR,
		onSkipReviewer: skipReviewer,
		onUndoAssignment: undoAssignment,
		onRefresh: handleManualRefresh,
		isNextReviewerAvailable: !!nextReviewer,
	});

	// Load show assignments preference from localStorage
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

	// Save show assignments preference to localStorage
	useEffect(() => {
		localStorage.setItem("showAssignments", showAssignments.toString());
	}, [showAssignments]);

	// Save show tags preference to localStorage
	useEffect(() => {
		localStorage.setItem("showTags", showTags.toString());
	}, [showTags]);

	// Save compact layout preference to localStorage
	useEffect(() => {
		localStorage.setItem("compactLayout", compactLayout.toString());
	}, [compactLayout]);

	// Save show emails preference to localStorage
	useEffect(() => {
		localStorage.setItem("showEmails", showEmails.toString());
	}, [showEmails]);

	const handleDataUpdate = async () => {
		await fetchData();
		await refreshTags();
	};

	const handleImTheNextOneWithDialog = async () => {
		const result = await handleImTheNextOne();
		if (result.success && result.nextReviewer) {
			setNextAfterSkip(result.nextReviewer);
			setSkipConfirmDialogOpen(true);
		}
	};

	const handleConfirmSkipToNext = async () => {
		if (!nextReviewer || !nextAfterSkip) return;

		await confirmSkipToNext(nextReviewer, nextAfterSkip);

		// Close the dialog
		setSkipConfirmDialogOpen(false);
		setNextAfterSkip(null);
	};

	const handleCancelSkip = () => {
		setSkipConfirmDialogOpen(false);
		setNextAfterSkip(null);
	};

	const importFileHandler = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		await importData(file);

		// Reset the input
		event.target.value = "";
	};

	const loadSnapshots = async () => {
		setSnapshotsLoading(true);
		try {
			const snapshotData = await getSnapshots();
			// Format dates on client side using user's local timezone
			const formattedSnapshots = snapshotData.map((snapshot) => ({
				...snapshot,
				formattedDate: formatSnapshotDate(new Date(snapshot.timestamp)),
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

	const formatSnapshotDate = (date: Date): string => {
		const options: Intl.DateTimeFormatOptions = {
			weekday: "short",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		};

		return date.toLocaleDateString("en-US", options);
	};

	const handleOpenSnapshotDialog = () => {
		loadSnapshots();
		setSnapshotDialogOpen(true);
	};

	const handleRestoreSnapshot = async (key: string) => {
		try {
			const success = await restoreFromSnapshot(key);

			if (success) {
				// Refresh data after restore
				await fetchData();

				toast({
					title: t("common.success"),
					description: t("messages.snapshotRestored"),
				});
				setSnapshotDialogOpen(false);
			} else {
				toast({
					title: t("common.error"),
					description: t("messages.restoreSnapshotFailed"),
					variant: "destructive",
				});
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

	const toggleShowAssignments = () => {
		setShowAssignments((prev) => !prev);
	};

	const toggleShowTags = () => {
		setShowTags((prev) => !prev);
	};

	const toggleCompactLayout = () => {
		setCompactLayout((prev) => !prev);
	};

	const toggleShowEmails = () => {
		setShowEmails((prev) => !prev);
	};

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
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
				<h1 className="text-3xl font-bold">
					{t("pr.title")} - Remuneraciones Perú
				</h1>
				<div className="flex items-center gap-2">
					<HeaderOptionsDrawer
						compactLayout={compactLayout}
						showAssignments={showAssignments}
						showTags={showTags}
						showEmails={showEmails}
						isRefreshing={isRefreshing}
						onToggleCompactLayout={toggleCompactLayout}
						onToggleShowAssignments={toggleShowAssignments}
						onToggleShowTags={toggleShowTags}
						onToggleShowEmails={toggleShowEmails}
						onOpenSnapshotDialog={handleOpenSnapshotDialog}
						onManualRefresh={handleManualRefresh}
						formatLastUpdated={formatLastUpdated}
					/>

					{compactLayout && (
						<Drawer
							open={reviewersDrawerOpen}
							onOpenChange={setReviewersDrawerOpen}
						>
							<DrawerTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="flex items-center gap-1"
								>
									<Menu className="h-4 w-4" />
									<span className="hidden sm:inline">
										{t("pr.manageReviewers")}
									</span>
								</Button>
							</DrawerTrigger>
							<DrawerContent>
								<DrawerHeader>
									<DrawerTitle>{t("pr.reviewers")}</DrawerTitle>
									<DrawerDescription>
										{t("manage-reviewers-and-their-assignments")}
									</DrawerDescription>
								</DrawerHeader>
								<div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
									<ReviewersTable
									reviewers={reviewers}
									nextReviewer={nextReviewer}
									assignmentFeed={assignmentFeed}
									showAssignments={showAssignments}
									showTags={showTags}
									showEmails={showEmails}
									onToggleAbsence={handleToggleAbsence}
									onDataUpdate={fetchData}
									updateReviewer={updateReviewer}
								/>
								</div>
								<DrawerFooter className="flex flex-col gap-4">
									<div className="flex flex-wrap gap-2 justify-center">
										<TagManager
											reviewers={reviewers}
											onDataUpdate={handleDataUpdate}
										/>
										<AddReviewerDialog
											onAddReviewer={addReviewer}
											trigger={
												<Button variant="outline" size="sm">
													<UserPlus className="h-4 w-4 mr-2" />
													{t("pr.addReviewer")}
												</Button>
											}
										/>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="outline" size="sm">
													<MoreHorizontal className="h-4 w-4 mr-2" />
													{t("pr.actions")}
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuLabel>
													{t("pr.manageData")}
												</DropdownMenuLabel>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onSelect={(e) => {
														e.preventDefault();
													}}
												>
													<DeleteReviewerDialog
														reviewers={reviewers}
														onDeleteReviewer={removeReviewer}
														trigger={
															<div className="flex items-center w-full">
																<UserMinus className="h-4 w-4 mr-2" />
																{t("pr.deleteReviewer")}
															</div>
														}
													/>
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem onClick={handleResetCounts}>
													<RotateCw className="h-4 w-4 mr-2" />
													{t("reset-counts")}
												</DropdownMenuItem>
												<DropdownMenuItem onClick={exportData}>
													<Save className="h-4 w-4 mr-2" />
													{t("pr.exportData")}
												</DropdownMenuItem>
												<DropdownMenuItem
													onSelect={(e) => {
														e.preventDefault();
														document.getElementById("import-file")?.click();
													}}
												>
													<Download className="h-4 w-4 mr-2" />
													{t("history.import")}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
									<DrawerClose asChild>
										<Button variant="outline">{t("common.close")}</Button>
									</DrawerClose>
								</DrawerFooter>
							</DrawerContent>
						</Drawer>
					)}
				</div>
			</div>

			{compactLayout ? (
				// Compact Layout: 60% assignment, 40% history, reviewers in drawer
				<div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)]">
					<div className="flex-1 lg:w-[60%] flex flex-col space-y-6">
						{/* Assignment Card */}
						<div className="flex-1">
							<AssignmentCard
						nextReviewer={nextReviewer}
						reviewers={reviewers}
						assignmentFeed={assignmentFeed}
						onAssignPR={assignPR}
						onUndoAssignment={undoAssignment}
						onImTheNextOne={handleImTheNextOneWithDialog}
						user={userInfo}
					/>
						</div>

						{/* Force Assign Dialog */}
						<div className="border rounded-lg p-4 bg-muted/50 space-y-4">
							<ForceAssignDialog
								reviewers={reviewers}
								onDataUpdate={handleDataUpdate}
								user={userInfo}
							/>
							{hasTags && (
								<TrackBasedAssignment
									reviewers={reviewers}
									onDataUpdate={handleDataUpdate}
									user={userInfo}
								/>
							)}
						</div>
					</div>

					{/* History Section - 40% */}
					<div className="flex-1 lg:w-[40%]">
						<FeedHistory assignmentFeed={assignmentFeed} />
					</div>
				</div>
			) : (
				// Classic Layout: Original grid layout
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<Card className="md:col-span-2">
						<CardHeader>
							<div className="flex flex-wrap gap-2 justify-between items-center">
								<CardTitle>{t("pr.reviewers")}</CardTitle>
								<div className="flex flex-wrap gap-2">
									<TagManager
										reviewers={reviewers}
										onDataUpdate={handleDataUpdate}
									/>
									<AddReviewerDialog
										onAddReviewer={addReviewer}
										trigger={
											<Button variant="outline" size="sm">
												<UserPlus className="h-4 w-4 mr-2" />
												{t("pr.addReviewer")}
											</Button>
										}
									/>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="outline" size="sm">
												<MoreHorizontal className="h-4 w-4 mr-2" />
												<span className="sm:inline">{t("pr.actions")}</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuLabel>
												{t("pr.manageData")}
											</DropdownMenuLabel>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onSelect={(e) => {
													e.preventDefault();
												}}
											>
												<DeleteReviewerDialog
													reviewers={reviewers}
													onDeleteReviewer={removeReviewer}
													trigger={
														<div className="flex items-center w-full">
															<UserMinus className="h-4 w-4 mr-2" />
															{t("pr.deleteReviewer")}
														</div>
													}
												/>
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem onClick={handleResetCounts}>
												<RotateCw className="h-4 w-4 mr-2" />
												{t("reset-counts")}
											</DropdownMenuItem>
											<DropdownMenuItem onClick={exportData}>
												<Save className="h-4 w-4 mr-2" />
												{t("pr.exportData")}
											</DropdownMenuItem>
											<DropdownMenuItem
												onSelect={(e) => {
													e.preventDefault();
													document.getElementById("import-file")?.click();
												}}
											>
												<Download className="h-4 w-4 mr-2" />
												{t("import-data")}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<ReviewersTable
				reviewers={reviewers}
				nextReviewer={nextReviewer}
				assignmentFeed={assignmentFeed}
				showAssignments={showAssignments}
				showTags={showTags}
				showEmails={showEmails}
				onToggleAbsence={handleToggleAbsence}
				onDataUpdate={fetchData}
				updateReviewer={updateReviewer}
			/>
						</CardContent>
					</Card>
					<div className="flex flex-col gap-6">
						<AssignmentCard
							nextReviewer={nextReviewer}
							reviewers={reviewers}
							assignmentFeed={assignmentFeed}
							onAssignPR={assignPR}
							onUndoAssignment={undoAssignment}
							onImTheNextOne={handleImTheNextOneWithDialog}
							user={userInfo}
						/>

						<div className="space-y-4">
							<ForceAssignDialog
								reviewers={reviewers}
								onDataUpdate={handleDataUpdate}
								user={userInfo}
							/>
							{hasTags && (
								<TrackBasedAssignment
									reviewers={reviewers}
									onDataUpdate={handleDataUpdate}
									user={userInfo}
								/>
							)}
						</div>

						<RecentAssignments assignmentFeed={assignmentFeed} />
					</div>
				</div>
			)}

			{/* Hidden input for import functionality */}
			<input
				id="import-file"
				type="file"
				accept=".json"
				onChange={importFileHandler}
				className="hidden"
			/>

			{/* Snapshot Dialog */}
			<Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>{t("change-history")}</DialogTitle>
						<DialogDescription>
							{t("history.restoreDescription")}
						</DialogDescription>
					</DialogHeader>
					<div className="py-4 max-h-[300px] overflow-y-auto">
						{snapshotsLoading ? (
							<div className="text-center py-4">
								<p>{t("common.loading")}</p>
							</div>
						) : snapshots.length === 0 ? (
							<div className="text-center py-4">
								<p>{t("history.noSnapshots")}</p>
								<p className="text-sm text-muted-foreground mt-2">
									{t("history.changesAutoSaved")}
								</p>
							</div>
						) : (
							<div className="space-y-2">
								{snapshots.map((snapshot) => (
									<div
										key={snapshot.key}
										className="flex justify-between items-center p-3 border rounded-md hover:bg-muted/50"
									>
										<div>
											<p className="font-medium">{snapshot.formattedDate}</p>
											<p className="text-sm text-muted-foreground">
												{snapshot.description}
											</p>
										</div>
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleRestoreSnapshot(snapshot.key)}
										>
											{t("history.restore")}
										</Button>
									</div>
								))}
							</div>
						)}
					</div>
					<DialogFooter></DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Skip Confirmation Dialog */}
			<SkipConfirmationDialog
				isOpen={skipConfirmDialogOpen}
				onOpenChange={setSkipConfirmDialogOpen}
				nextReviewer={nextReviewer}
				nextAfterSkip={nextAfterSkip}
				onConfirm={handleConfirmSkipToNext}
				onCancel={handleCancelSkip}
			/>

			<div className="text-center text-xs text-muted-foreground">
				{t("last-updated")} {formatLastUpdated()}
				{t("updates-automatically-every-minute-when-tab-is-active")}
			</div>
		</div>
	);
}
