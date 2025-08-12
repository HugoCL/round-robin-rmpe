import { AssignmentCard } from "../AssignmentCard";
import { FeedHistory } from "../FeedHistory";
import { ForceAssignDialog } from "../dialogs/ForceAssignDialog";
import { TrackBasedAssignment } from "../TrackBasedAssignment";

/**
 * CompactLayout component displays a compact layout for the PR review assignment page.
 */
import { usePRReview } from "../PRReviewContext";

export function CompactLayout() {
	const { hasTags } = usePRReview();
	return (
		<div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)]">
			<div className="flex-1 lg:w-[60%] flex flex-col space-y-6">
				{/* Assignment Card */}
				<div className="flex-1">
					<AssignmentCard />
				</div>

				{/* Force Assign Dialog */}
				<div className="border rounded-lg p-4 bg-muted/50 space-y-4">
					<ForceAssignDialog />
					{hasTags && (
						<TrackBasedAssignment />
					)}
				</div>
			</div>

			{/* History Section - 40% */}
			<div className="flex-1 lg:w-[40%]">
				<FeedHistory />
			</div>
		</div>
	);
}
