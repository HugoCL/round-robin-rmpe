"use client";

import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useTeamWeeklyPrCount } from "@/hooks/useTeamWeeklyPrCount";
import { LastPrRow } from "../header/HeaderStatusBar";
import { usePRReview } from "../PRReviewContext";
import { useWidgetSize, WidgetFrame } from "./WidgetFrame";

/** The week as a sentence, not as stat tiles: what you got, what you sent, the team's total. */
export function MyWeekWidget() {
	const t = useTranslations();
	const locale = useLocale();
	const { teamSlug } = usePRReview();
	const small = useWidgetSize() === "small";
	const [now] = useState(() => Date.now());
	const { count: teamCount, isLoading: isTeamLoading } =
		useTeamWeeklyPrCount(teamSlug);
	const stats = useQuery(
		api.queries.getMyWeeklyAssignmentStats,
		teamSlug ? { teamSlug, now } : "skip",
	);

	return (
		<WidgetFrame>
			{stats && !isTeamLoading ? (
				<p className="text-sm leading-relaxed text-pretty text-muted-foreground">
					{t.rich("widgets.myWeek.summary", {
						received: stats.received,
						sent: stats.sent,
						team: teamCount,
						b: (chunks) => (
							<b className="font-semibold text-foreground tabular-nums">
								{chunks}
							</b>
						),
					})}
				</p>
			) : (
				<Skeleton className="h-5 w-4/5" />
			)}
			{/* Small is the sentence alone. */}
			{small ? null : (
				<dl className="mt-3 grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-2 text-sm">
					<LastPrRow
						label={t("headerStatus.lastReceived")}
						pr={stats?.lastReceived}
						locale={locale}
					/>
					<LastPrRow
						label={t("headerStatus.lastSent")}
						pr={stats?.lastSent}
						locale={locale}
					/>
				</dl>
			)}
		</WidgetFrame>
	);
}
