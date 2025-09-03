import {
	Download,
	MoreHorizontal,
	RotateCw,
	Save,
	UserMinus,
	UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
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
import { AssignmentCard } from "../AssignmentCard";
import { CollapsibleAssignmentsPanel } from "../CollapsibleAssignmentsPanel";
import { AddReviewerDialog } from "../dialogs/AddReviewerDialog";
import { DeleteReviewerDialog } from "../dialogs/DeleteReviewerDialog";
import { ForceAssignDialog } from "../dialogs/ForceAssignDialog";
/**
 * ClassicLayout component displays the original grid layout for the PR review assignment page.
 */
import { usePRReview } from "../PRReviewContext";
import { RecentAssignments } from "../RecentAssignments";
import { ReviewersTable } from "../ReviewersTable";
import { TagManager } from "../TagManager";
import { TrackBasedAssignment } from "../TrackBasedAssignment";

export function ClassicLayout() {
	const t = useTranslations();
	const {
		reviewers,
		hasTags,
		teamSlug,
		// onDataUpdate (not needed here),
		addReviewer,
		removeReviewer,
		handleResetCounts,
		exportData,
	} = usePRReview();

	// Start collapsed by default
	// (Assignments collapse state handled by CollapsibleAssignmentsPanel)

	return (
		<div className="space-y-6">
			<CollapsibleAssignmentsPanel />

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<Card className="md:col-span-1 lg:col-span-2">
					<CardHeader>
						<div className="flex flex-wrap gap-2 justify-between items-center">
							<CardTitle>{t("pr.reviewers")}</CardTitle>
							<div className="flex flex-wrap gap-2">
								<TagManager />
								<AddReviewerDialog
									onAddReviewer={async (name, email) => {
										await addReviewer(name, email);
										return true;
									}}
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
						<ReviewersTable teamSlug={teamSlug} />
					</CardContent>
				</Card>
				<div className="flex flex-col gap-6 md:col-span-1 lg:col-span-1">
					<AssignmentCard />

					<div className="space-y-4">
						<ForceAssignDialog />
						{hasTags && <TrackBasedAssignment />}
					</div>

					<RecentAssignments teamSlug={teamSlug} />
				</div>
			</div>
		</div>
	);
}
