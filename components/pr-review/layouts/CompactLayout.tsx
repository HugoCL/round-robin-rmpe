import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ActiveEventsList } from "../ActiveEventsList";
import { AssignmentCard } from "../AssignmentCard";
import { CreateEventDialog } from "../dialogs/CreateEventDialog";
import { ForceAssignDialog } from "../dialogs/ForceAssignDialog";
import { FeedHistory } from "../FeedHistory";
/**
 * CompactLayout component displays a compact layout for the PR review assignment page.
 */
import { usePRReview } from "../PRReviewContext";

export function CompactLayout() {
	const { teamSlug } = usePRReview();
	const t = useTranslations();
	return (
		<div className="space-y-6">
			{/* Active Events */}
			<ActiveEventsList />

			<div className="flex flex-col lg:flex-row gap-6">
				<div className="flex-1 lg:w-[60%] flex flex-col space-y-6">
					{/* Assignment Card */}
					<div className="flex-1">
						<AssignmentCard />
					</div>

					{/* Force Assign Dialog */}
					<div className="border  p-4 bg-muted/50 space-y-4">
						<ForceAssignDialog />
						<CreateEventDialog
							trigger={
								<Button variant="outline" className="w-full">
									<Calendar className="h-4 w-4 mr-2" />
									{t("events.createEvent")}
								</Button>
							}
						/>
					</div>
				</div>

				{/* History Section - 40% */}
				<div className="flex-1 lg:w-[40%]">
					<FeedHistory teamSlug={teamSlug} />
				</div>
			</div>
		</div>
	);
}
