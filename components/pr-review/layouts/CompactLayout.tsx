import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ActiveEventsList } from "../ActiveEventsList";
import { AssignmentCard } from "../AssignmentCard";
import { FeedHistory } from "../FeedHistory";
/**
 * CompactLayout component displays a compact layout for the PR review assignment page.
 */
import { usePRReview } from "../PRReviewContext";

export function CompactLayout() {
	const { teamSlug } = usePRReview();
	const activeEvents = useQuery(
		api.queries.getActiveEvents,
		teamSlug ? { teamSlug } : "skip",
	);
	const hasActiveEvents = (activeEvents?.length ?? 0) > 0;
	return (
		<div className="mt-5 space-y-6">
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.9fr)]">
				<div className="space-y-6">
					<section className="page-enter-soft xl:sticky xl:top-5">
						<AssignmentCard />
					</section>
				</div>

				<div className="space-y-6">
					{hasActiveEvents ? (
						<section className="page-enter space-y-3">
							<h3 className="text-lg font-semibold">
								{t("events.upcomingEvents")}
							</h3>
							<ActiveEventsList />
						</section>
					) : null}
					<section className="page-enter">
						<FeedHistory teamSlug={teamSlug} />
					</section>
				</div>
			</div>
		</div>
	);
}
