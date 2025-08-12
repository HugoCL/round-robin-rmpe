import { useTranslations } from "next-intl";
import {
	Download,
	MoreHorizontal,
	RotateCw,
	Save,
	UserMinus,
	UserPlus,
} from "lucide-react";
import { AssignmentCard } from "../AssignmentCard";
import { RecentAssignments } from "../RecentAssignments";
import { ReviewersTable } from "../ReviewersTable";
import { TagManager } from "../TagManager";
import { TrackBasedAssignment } from "../TrackBasedAssignment";
import { AddReviewerDialog } from "../dialogs/AddReviewerDialog";
import { DeleteReviewerDialog } from "../dialogs/DeleteReviewerDialog";
import { ForceAssignDialog } from "../dialogs/ForceAssignDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Assignment, Reviewer, UserInfo } from "@/lib/types";

interface ClassicLayoutProps {
	reviewers: Reviewer[];
	nextReviewer: Reviewer | null;
	assignmentFeed: Assignment;
	showAssignments: boolean;
	showTags: boolean;
	showEmails: boolean;
	hasTags: boolean;
	userInfo: UserInfo | null;
	teamSlug?: string;
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
	assignPR: () => void;
	undoAssignment: () => void;
	handleImTheNextOneWithDialog: () => void;
}

/**
 * ClassicLayout component displays the original grid layout for the PR review assignment page.
 * @param {ClassicLayoutProps} props - The props for the component.
 */
export function ClassicLayout({
	reviewers,
	nextReviewer,
	assignmentFeed,
	showAssignments,
	showTags,
	showEmails,
	hasTags,
	userInfo,
	teamSlug,
	onToggleAbsence,
	onDataUpdate,
	updateReviewer,
	addReviewer,
	removeReviewer,
	handleResetCounts,
	exportData,
	assignPR,
	undoAssignment,
	handleImTheNextOneWithDialog,
}: ClassicLayoutProps) {
	const t = useTranslations();

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
			<Card className="md:col-span-2">
				<CardHeader>
					<div className="flex flex-wrap gap-2 justify-between items-center">
						<CardTitle>{t("pr.reviewers")}</CardTitle>
						<div className="flex flex-wrap gap-2">
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
										<span className="sm:inline">{t("pr.actions")}</span>
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
						assignmentFeed={{
							lastAssigned: assignmentFeed?.lastAssigned || undefined,
						}}
						showAssignments={showAssignments}
						showTags={showTags}
						showEmails={showEmails}
						onToggleAbsence={onToggleAbsence}
						onDataUpdate={onDataUpdate}
						updateReviewer={updateReviewer}
						teamSlug={teamSlug}
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
						onDataUpdate={onDataUpdate}
						user={userInfo}
						teamSlug={teamSlug}
					/>
					{hasTags && (
						<TrackBasedAssignment
							reviewers={reviewers}
							onDataUpdate={onDataUpdate}
							user={userInfo}
							teamSlug={teamSlug}
						/>
					)}
				</div>

				<RecentAssignments teamSlug={teamSlug} />
			</div>
		</div>
	);
}
