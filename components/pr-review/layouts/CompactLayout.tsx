import { AssignmentCard } from "../AssignmentCard";
import { FeedHistory } from "../FeedHistory";
import { ForceAssignDialog } from "../dialogs/ForceAssignDialog";
import { TrackBasedAssignment } from "../TrackBasedAssignment";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Assignment, Reviewer, UserInfo } from "@/lib/types";

interface CompactLayoutProps {
	reviewers: Reviewer[];
	nextReviewer: Reviewer | null;
	assignmentFeed: Assignment;
	hasTags: boolean;
	userInfo: UserInfo | null;
	teamSlug?: string;
	onDataUpdate: () => void;
	assignPR: () => void;
	undoAssignment: () => void;
	handleImTheNextOneWithDialog: () => void;
}

/**
 * CompactLayout component displays a compact layout for the PR review assignment page.
 * @param {CompactLayoutProps} props - The props for the component.
 */
export function CompactLayout({
	reviewers,
	nextReviewer,
	assignmentFeed,
	hasTags,
	userInfo,
	teamSlug,
	onDataUpdate,
	assignPR,
	undoAssignment,
	handleImTheNextOneWithDialog,
}: CompactLayoutProps) {
	return (
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
			</div>

			{/* History Section - 40% */}
			<div className="flex-1 lg:w-[40%]">
				<FeedHistory teamSlug={teamSlug} />
			</div>
		</div>
	);
}
