import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { AssignmentCard } from "../AssignmentCard";
import { FeedHistory } from "../FeedHistory";
import { ForeignTeamAssignmentCard } from "../ForeignTeamAssignmentCard";
import { usePRReview } from "../PRReviewContext";
import { ReviewersPanel } from "../ReviewersPanel";

/** Below this width the three columns can't all hold a usable measure. */
const BOTH_PANELS_QUERY = "(min-width: 1500px)";

export function CompactLayout() {
	const { teamSlug, isForeignTeamView } = usePRReview();
	const canShowBothPanels = useMediaQuery(BOTH_PANELS_QUERY);
	const [historyOpen, setHistoryOpen] = useLocalStorage(
		"la-lista-history-open",
		false,
	);
	const [reviewersOpen, setReviewersOpen] = useLocalStorage(
		"la-lista-reviewers-open",
		false,
	);
	// Both panels can stay open on wide screens; narrower ones still trade one
	// for the other so the assignment column keeps a readable width.
	const bothOpen = reviewersOpen && historyOpen && canShowBothPanels;
	const historyExpanded = historyOpen && (bothOpen || !reviewersOpen);
	const reviewersExpanded = reviewersOpen;

	const handleReviewersOpenChange = (open: boolean) => {
		setReviewersOpen(open);
		if (open && !canShowBothPanels) {
			setHistoryOpen(false);
		}
	};

	const handleHistoryOpenChange = (open: boolean) => {
		setHistoryOpen(open);
		if (open && !canShowBothPanels) {
			setReviewersOpen(false);
		}
	};

	return (
		<div className="mt-3 flex flex-col gap-4 sm:mt-5 sm:gap-6 lg:mt-6 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
			<div
				className={cn(
					"grid items-stretch gap-4 sm:gap-6 lg:min-h-0 lg:flex-1",
					!reviewersExpanded &&
						!historyExpanded &&
						"lg:grid-cols-[3.5rem_minmax(0,1fr)_3.5rem]",
					reviewersExpanded &&
						!historyExpanded &&
						"lg:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)_3.5rem] 2xl:grid-cols-[minmax(420px,0.72fr)_minmax(0,1.28fr)_3.5rem]",
					!reviewersExpanded &&
						historyExpanded &&
						"lg:grid-cols-[3.5rem_minmax(0,1.18fr)_minmax(340px,0.82fr)] 2xl:grid-cols-[3.5rem_minmax(0,1.28fr)_minmax(420px,0.72fr)]",
					reviewersExpanded &&
						historyExpanded &&
						"lg:grid-cols-[minmax(320px,0.7fr)_minmax(0,1.6fr)_minmax(320px,0.7fr)]",
				)}
			>
				<ReviewersPanel
					teamSlug={teamSlug}
					open={reviewersExpanded}
					onOpenChange={handleReviewersOpenChange}
					className="order-2 lg:order-1"
				/>
				<div className="order-1 flex min-w-0 flex-col gap-4 sm:gap-6 lg:order-2 lg:h-full lg:min-h-0 lg:overflow-hidden">
					<section className="page-enter-soft lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:[&>[data-slot=card]]:min-h-0 lg:[&>[data-slot=card]]:flex-1">
						{isForeignTeamView ? (
							<ForeignTeamAssignmentCard />
						) : (
							<AssignmentCard />
						)}
					</section>
				</div>
				<FeedHistory
					teamSlug={teamSlug}
					open={historyExpanded}
					onOpenChange={handleHistoryOpenChange}
					className="order-3"
				/>
			</div>
		</div>
	);
}
