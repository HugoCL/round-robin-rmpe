import { useTranslations } from "next-intl";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { HeaderOptionsDrawer } from "../HeaderOptionsDrawer";
import { Button } from "@/components/ui/button";
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
import {
	Download,
	Menu,
	MoreHorizontal,
	RotateCw,
	Save,
	UserMinus,
	UserPlus,
} from "lucide-react";
import { ReviewersTable } from "../ReviewersTable";
import { TagManager } from "../TagManager";
import { AddReviewerDialog } from "../dialogs/AddReviewerDialog";
import { DeleteReviewerDialog } from "../dialogs/DeleteReviewerDialog";
import type { Doc } from "@/convex/_generated/dataModel";

interface PageHeaderProps {
	teamSlug?: string;
	compactLayout: boolean;
	showAssignments: boolean;
	showTags: boolean;
	showEmails: boolean;
	isRefreshing: boolean;
	reviewers: Doc<"reviewers">[];
	nextReviewer: Doc<"reviewers"> | null;
	assignmentFeed: {
		lastAssigned?: {
			reviewerId: string;
			timestamp: number;
		};
	};
	reviewersDrawerOpen: boolean;
	onToggleCompactLayout: () => void;
	onToggleShowAssignments: () => void;
	onToggleShowTags: () => void;
	onToggleShowEmails: () => void;
	onOpenSnapshotDialog: () => void;
	onManualRefresh: () => void;
	formatLastUpdated: () => string;
	setReviewersDrawerOpen: (isOpen: boolean) => void;
	onToggleAbsence: (id: Doc<"reviewers">["_id"]) => void;
	onDataUpdate: () => void;
	updateReviewer: (
		id: Doc<"reviewers">["_id"],
		data: Partial<Doc<"reviewers">>,
	) => void;
	addReviewer: (name: string, email: string) => Promise<void>;
	removeReviewer: (id: Doc<"reviewers">["_id"]) => void;
	handleResetCounts: () => void;
	exportData: () => void;
}

/**
 * PageHeader component displays the main title, team switcher, and action buttons.
 * @param {PageHeaderProps} props - The props for the component.
 */
export function PageHeader({
	teamSlug,
	compactLayout,
	showAssignments,
	showTags,
	showEmails,
	isRefreshing,
	reviewers,
	nextReviewer,
	assignmentFeed,
	reviewersDrawerOpen,
	onToggleCompactLayout,
	onToggleShowAssignments,
	onToggleShowTags,
	onToggleShowEmails,
	onOpenSnapshotDialog,
	onManualRefresh,
	formatLastUpdated,
	setReviewersDrawerOpen,
	onToggleAbsence,
	onDataUpdate,
	updateReviewer,
	addReviewer,
	removeReviewer,
	handleResetCounts,
	exportData,
}: PageHeaderProps) {
	const t = useTranslations();

	return (
		<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
			<div className="flex items-center gap-3 flex-wrap">
				<h1 className="text-3xl font-bold">{t("pr.title")}</h1>
				<TeamSwitcher teamSlug={teamSlug} />
			</div>
			<div className="flex items-center gap-2">
				<HeaderOptionsDrawer
					compactLayout={compactLayout}
					showAssignments={showAssignments}
					showTags={showTags}
					showEmails={showEmails}
					isRefreshing={isRefreshing}
					onToggleCompactLayout={onToggleCompactLayout}
					onToggleShowAssignments={onToggleShowAssignments}
					onToggleShowTags={onToggleShowTags}
					onToggleShowEmails={onToggleShowEmails}
					onOpenSnapshotDialog={onOpenSnapshotDialog}
					onManualRefresh={onManualRefresh}
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
								<span className="hidden sm:inline">{t("pr.manageReviewers")}</span>
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
									onToggleAbsence={onToggleAbsence}
									onDataUpdate={onDataUpdate}
									updateReviewer={updateReviewer}
									teamSlug={teamSlug}
								/>
							</div>
							<DrawerFooter className="flex flex-col gap-4">
								<div className="flex flex-wrap gap-2 justify-center">
									<TagManager
										reviewers={reviewers}
										onDataUpdate={onDataUpdate}
										teamSlug={teamSlug}
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
											<DropdownMenuLabel>{t("pr.manageData")}</DropdownMenuLabel>
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
	);
}
