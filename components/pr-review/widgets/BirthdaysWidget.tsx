"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/initials";
import { getMonthDayInTimeZone } from "@/lib/reviewerAvailability";
import { usePRReview } from "../PRReviewContext";
import { WidgetEmpty, widgetRowClass } from "./parts";
import { WidgetFrame } from "./WidgetFrame";

const SHOWN = 5;

/** The next birthdays on the team, nearest first. */
export function BirthdaysWidget() {
	const t = useTranslations();
	const locale = useLocale();
	const { reviewers, teamTimezone } = usePRReview();
	const [now] = useState(() => Date.now());
	const today = getMonthDayInTimeZone(now, teamTimezone);
	// Month and day as one sortable number; a date already past this year sorts
	// after every date still to come.
	const todayRank = today.month * 100 + today.day;
	const upcoming = reviewers
		.flatMap((reviewer) => {
			if (!reviewer.birthdayMonth || !reviewer.birthdayDay) return [];
			const rank = reviewer.birthdayMonth * 100 + reviewer.birthdayDay;
			return [
				{
					reviewer,
					month: reviewer.birthdayMonth,
					day: reviewer.birthdayDay,
					isToday: rank === todayRank,
					order: rank >= todayRank ? rank : rank + 10_000,
				},
			];
		})
		.sort((a, b) => a.order - b.order)
		.slice(0, SHOWN);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		day: "numeric",
		month: "short",
	});

	return (
		<WidgetFrame>
			{upcoming.length === 0 ? (
				<WidgetEmpty>{t("widgets.birthdays.empty")}</WidgetEmpty>
			) : (
				<ul>
					{upcoming.map(({ reviewer, month, day, isToday }) => (
						<li key={reviewer._id} className={widgetRowClass}>
							<Avatar size="sm">
								<AvatarFallback>{getInitials(reviewer.name)}</AvatarFallback>
							</Avatar>
							<span className="min-w-0 flex-1 truncate">{reviewer.name}</span>
							{isToday ? (
								<Badge variant="secondary">
									{t("widgets.birthdays.today")}
								</Badge>
							) : (
								<span className="text-xs text-muted-foreground">
									{/* A leap year, so 29 Feb formats as itself. */}
									{dayFormat.format(new Date(Date.UTC(2024, month - 1, day)))}
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</WidgetFrame>
	);
}
