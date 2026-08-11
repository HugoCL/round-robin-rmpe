import { useQuery } from "convex/react";
import { ChevronDown, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/convex/_generated/api";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";
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
	const [historyOpen, setHistoryOpen] = useLocalStorage(
		"la-lista-history-open",
		false,
	);
	const activeEvents = useQuery(
		api.queries.getActiveEvents,
		teamSlug ? { teamSlug } : "skip",
	);
	const hasActiveEvents = (activeEvents?.length ?? 0) > 0;
	return (
		<div className="mt-5 flex flex-col gap-6 lg:mt-6 lg:flex-1">
			<div
				className={cn(
					"grid items-stretch gap-6 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_3.5rem]",
					historyOpen &&
						"lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)] 2xl:grid-cols-[minmax(0,1.28fr)_minmax(420px,0.72fr)]",
				)}
			>
				<div className="flex min-w-0 flex-col gap-6 lg:h-full">
					<section className="page-enter-soft lg:flex lg:flex-1 lg:flex-col lg:[&>[data-slot=card]]:flex-1">
						{isForeignTeamView ? (
							<ForeignTeamAssignmentCard />
						) : (
							<AssignmentCard />
						)}
					</section>
					{hasActiveEvents ? (
						<section className="page-enter flex flex-col gap-3">
							<h3 className="text-lg font-semibold lg:text-xl">
								{t("events.upcomingEvents")}
							</h3>
							<ActiveEventsList />
						</section>
					) : null}

					<Collapsible
						open={showAvailability}
						onOpenChange={setShowAvailability}
						asChild
					>
						<section className="page-enter calm-panel p-3 shadow-none">
							<CollapsibleTrigger asChild>
								<button
									className="flex min-h-10 w-full items-center justify-between rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
									type="button"
								>
									<div className="flex items-center gap-2">
										<Users className="size-4 text-muted-foreground" />
										<h3 className="text-base font-semibold">
											{t("pr.reviewers")}
										</h3>
									</div>
									<ChevronDown
										className={cn(
											"size-4 text-muted-foreground transition-transform duration-300 ease-in-out motion-reduce:transition-none",
											showAvailability && "rotate-180",
										)}
									/>
								</button>
							</CollapsibleTrigger>
							<CollapsibleContent
								className="animation-duration-300 mt-2 max-h-[min(32rem,60dvh)] overflow-y-auto overscroll-contain border-t border-border/60 pb-2 pr-1 pt-3 ease-in-out [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:animation-duration-500"
								tabIndex={0}
								aria-label={t("pr.reviewers")}
							>
								<ReviewersTable teamSlug={teamSlug} readOnly={true} />
							</CollapsibleContent>
						</section>
					</Collapsible>
				</div>

				<FeedHistory
					teamSlug={teamSlug}
					open={historyOpen}
					onOpenChange={setHistoryOpen}
				/>
			</div>
		</div>
	);
}
