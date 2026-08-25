import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";
import { AssignmentCard } from "../AssignmentCard";
import { FeedHistory } from "../FeedHistory";
import { ForeignTeamAssignmentCard } from "../ForeignTeamAssignmentCard";
import { usePRReview } from "../PRReviewContext";
import { ReviewersPanel } from "../ReviewersPanel";

export function CompactLayout() {
	const { teamSlug, isForeignTeamView } = usePRReview();
	const [historyOpen, setHistoryOpen] = useLocalStorage(
		"la-lista-history-open",
		false,
	);
	const [reviewersOpen, setReviewersOpen] = useLocalStorage(
		"la-lista-reviewers-open",
		false,
	);
	const historyExpanded = historyOpen && !reviewersOpen;

	const handleReviewersOpenChange = (open: boolean) => {
		setReviewersOpen(open);
		if (open) {
			setHistoryOpen(false);
		}
	};

	const handleHistoryOpenChange = (open: boolean) => {
		setHistoryOpen(open);
		if (open) {
			setReviewersOpen(false);
		}
	};

	return (
		<div className="mt-3 flex flex-col gap-4 sm:mt-5 sm:gap-6 lg:mt-6 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
			<div
				className={cn(
					"grid items-stretch gap-4 sm:gap-6 lg:min-h-0 lg:flex-1",
					!reviewersOpen &&
						!historyExpanded &&
						"lg:grid-cols-[3.5rem_minmax(0,1fr)_3.5rem]",
					reviewersOpen &&
						"lg:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)_3.5rem] 2xl:grid-cols-[minmax(420px,0.72fr)_minmax(0,1.28fr)_3.5rem]",
					!reviewersOpen &&
						historyExpanded &&
						"lg:grid-cols-[3.5rem_minmax(0,1.18fr)_minmax(340px,0.82fr)] 2xl:grid-cols-[3.5rem_minmax(0,1.28fr)_minmax(420px,0.72fr)]",
				)}
			>
				<ReviewersPanel
					teamSlug={teamSlug}
					open={reviewersOpen}
					onOpenChange={handleReviewersOpenChange}
					className="order-2 lg:order-1"
				/>
				<div className="order-1 flex min-w-0 flex-col gap-4 sm:gap-6 lg:order-2 lg:h-full lg:min-h-0 lg:overflow-y-auto">
					<section className="page-enter-soft lg:flex lg:flex-1 lg:flex-col lg:[&>[data-slot=card]]:flex-1">
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
