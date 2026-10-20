import { useRef, useState } from "react";
import { AssignmentCard } from "../AssignmentCard";
import { FeedHistory } from "../FeedHistory";
import { ForeignTeamAssignmentCard } from "../ForeignTeamAssignmentCard";
import { usePRReview } from "../PRReviewContext";
import { ReviewersPanel } from "../ReviewersPanel";
import { ReviewersPanelContext } from "./ReviewersPanelContext";

export function CompactLayout() {
	const { teamSlug, isForeignTeamView } = usePRReview();
	const [reviewersOpen, setReviewersOpen] = useState(false);
	const reviewersOpenerRef = useRef<HTMLElement | null>(null);

	return (
		<ReviewersPanelContext.Provider
			value={{
				openPanel: (opener) => {
					reviewersOpenerRef.current = opener;
					setReviewersOpen(true);
				},
			}}
		>
			<div className="mt-3 flex flex-col gap-4 sm:mt-5 sm:gap-6 lg:mt-6 3xl:grid 3xl:grid-cols-[45rem_minmax(0,1fr)] 3xl:items-start">
				<section className="page-enter-soft">
					{isForeignTeamView ? (
						<ForeignTeamAssignmentCard />
					) : (
						<AssignmentCard />
					)}
				</section>
				<FeedHistory teamSlug={teamSlug} />
			</div>
			<ReviewersPanel
				teamSlug={teamSlug}
				open={reviewersOpen}
				onOpenChange={setReviewersOpen}
				returnFocusTo={reviewersOpenerRef}
			/>
		</ReviewersPanelContext.Provider>
	);
}
