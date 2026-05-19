import { useQuery } from "convex/react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { ActiveEventsList } from "../ActiveEventsList";
import { AssignmentCard } from "../AssignmentCard";
import { FeedHistory } from "../FeedHistory";
import { ForeignTeamAssignmentCard } from "../ForeignTeamAssignmentCard";
import { usePRReview } from "../PRReviewContext";
import { ReviewersTable } from "../ReviewersTable";

export function CompactLayout() {
	const { teamSlug, isForeignTeamView } = usePRReview();
	const t = useTranslations();
	const [showAvailability, setShowAvailability] = useState(false);
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

					<section className="page-enter rounded-3xl border border-border bg-card p-5 shadow-sm">
						<button
							onClick={() => setShowAvailability(!showAvailability)}
							className="flex w-full items-center justify-between text-left focus:outline-none"
							aria-expanded={showAvailability}
							type="button"
						>
							<div className="flex items-center gap-2">
								<Users className="h-5 w-5 text-muted-foreground" />
								<h3 className="text-lg font-semibold lg:text-xl">
									{t("pr.reviewers")}
								</h3>
							</div>
							{showAvailability ? (
								<ChevronUp className="h-5 w-5 text-muted-foreground" />
							) : (
								<ChevronDown className="h-5 w-5 text-muted-foreground" />
							)}
						</button>
						{showAvailability && (
							<div className="mt-4 pt-4 border-t border-border/60">
								<ReviewersTable teamSlug={teamSlug} readOnly={true} />
							</div>
						)}
					</section>

					<section className="page-enter">
						<FeedHistory teamSlug={teamSlug} />
					</section>
				</div>
			</div>
		</div>
	);
}
