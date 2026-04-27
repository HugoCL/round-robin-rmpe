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
		<div className="mt-5 flex flex-col gap-6 lg:mt-6">
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)] 2xl:grid-cols-[minmax(0,1.28fr)_minmax(420px,0.72fr)]">
				<div className="flex min-w-0 flex-col gap-6">
					<section className="page-enter-soft lg:sticky lg:top-5">
						{isForeignTeamView ? (
							<ForeignTeamAssignmentCard />
						) : (
							<AssignmentCard />
						)}
					</section>
				</div>

				<div className="flex min-w-0 flex-col gap-6">
					{hasActiveEvents ? (
						<section className="page-enter flex flex-col gap-3">
							<h3 className="text-lg font-semibold lg:text-xl">
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
