import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { ActiveEventsList } from "../ActiveEventsList";
import { AssignmentCard } from "../AssignmentCard";
import { FeedHistory } from "../FeedHistory";
import { ForeignTeamAssignmentCard } from "../ForeignTeamAssignmentCard";
/**
 * CompactLayout component displays a compact layout for the PR review assignment page.
 */
import { usePRReview } from "../PRReviewContext";

export function CompactLayout() {
	const { teamSlug, isForeignTeamView } = usePRReview();
	const t = useTranslations();
	const activeEvents = useQuery(
		api.queries.getActiveEvents,
		teamSlug ? { teamSlug } : "skip",
	);
	const hasActiveEvents = (activeEvents?.length ?? 0) > 0;
	return (
		<div className="mt-8 space-y-6">
			<div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)]">
				<div className="space-y-5">
					<section className="page-enter-soft lg:sticky lg:top-6">
						{isForeignTeamView ? (
							<ForeignTeamAssignmentCard />
						) : (
							<AssignmentCard />
						)}
					</section>
				</div>

				<div className="space-y-5">
					{hasActiveEvents ? (
						<section className="page-enter space-y-3">
							<h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
