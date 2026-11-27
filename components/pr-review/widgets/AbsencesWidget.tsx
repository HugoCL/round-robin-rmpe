"use client";

import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { buildAbsenceTimeline } from "@/lib/absenceTimeline";
import {
	buildTimelineDays,
	type DateKey,
	getTodayDateKey,
	getWeekdayOfDateKey,
} from "@/lib/plannedAbsences";
import { cn } from "@/lib/utils";
import { formatDateKeyDay } from "../dialogs/MarkAbsentDialog";
import { TeamAbsencesDialog } from "../dialogs/TeamAbsencesDialog";
import { usePRReview } from "../PRReviewContext";
import { WidgetEmpty } from "./parts";
import { useWidgetSize, WidgetFrame } from "./WidgetFrame";

/** Two working weeks, starting today. */
const DAY_COUNT = 10;

/** Names the small size spells out before it counts the rest. */
const SMALL_NAMES = 3;

const toUtcDate = (key: DateKey) => {
	const [year, month, day] = key.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day));
};

/** Who is away over the next two weeks, one strip of weekdays per person. */
export function AbsencesWidget() {
	const t = useTranslations();
	const locale = useLocale();
	const { reviewers, plannedAbsences, teamTimezone } = usePRReview();
	const size = useWidgetSize();
	const [now] = useState(() => Date.now());
	const todayKey = getTodayDateKey(now, teamTimezone);
	const days = useMemo(
		() => buildTimelineDays(todayKey, DAY_COUNT),
		[todayKey],
	);
	const rows = useMemo(
		() =>
			buildAbsenceTimeline({
				days,
				todayKey,
				timeZone: teamTimezone,
				reviewers,
				absences: plannedAbsences,
			}).rows.filter((row) => row.segments.length > 0),
		[days, todayKey, teamTimezone, reviewers, plannedAbsences],
	);
	const weekday = new Intl.DateTimeFormat(locale, {
		timeZone: "UTC",
		weekday: "narrow",
	});
	const nameOf = (reviewerId: string) =>
		reviewers.find((item) => item._id === reviewerId)?.name;
	// Small is one sentence: who is away, without the days.
	const away = rows.flatMap((row) => nameOf(row.reviewerId) ?? []);
	const awayNames = new Intl.ListFormat(locale, { type: "conjunction" }).format(
		away.length > SMALL_NAMES
			? [
					...away.slice(0, SMALL_NAMES),
					t("widgets.moreInline", { count: away.length - SMALL_NAMES }),
				]
			: away,
	);
	// A new week starts a little apart, so the strip reads as two weeks.
	const startsWeek = (index: number) =>
		index > 0 && getWeekdayOfDateKey(days[index]) === "monday";

	return (
		<WidgetFrame
			// Small says the window in its sentence.
			meta={size === "small" ? undefined : t("widgets.absences.window")}
			actions={
				<TeamAbsencesDialog
					trigger={
						<IconActionButton
							label={t("absenceTimeline.open")}
							className="-mr-2"
						>
							<CalendarDays />
						</IconActionButton>
					}
				/>
			}
		>
			{rows.length === 0 ? (
				<WidgetEmpty>{t("widgets.absences.empty")}</WidgetEmpty>
			) : size === "small" ? (
				<p className="text-sm leading-relaxed text-pretty text-muted-foreground">
					{t.rich("widgets.absences.summary", {
						count: away.length,
						names: awayNames,
						b: (chunks) => (
							<b className="font-medium text-foreground">{chunks}</b>
						),
					})}
				</p>
			) : (
				<ul className="flex flex-col gap-1.5 text-sm">
					<li aria-hidden="true" className="flex justify-end gap-[3px]">
						{days.map((day, index) => (
							<span
								key={day}
								className={cn(
									"w-4 text-center text-xs uppercase text-muted-foreground",
									startsWeek(index) && "ml-1.5",
									day === todayKey && "font-semibold text-primary",
								)}
							>
								{weekday.format(toUtcDate(day))}
							</span>
						))}
					</li>
					{rows.map((row) => {
						const ranges = row.segments
							.map((segment) =>
								segment.endDate === null
									? t("widgets.absences.openEnded", {
											start: formatDateKeyDay(segment.startDate, locale),
										})
									: segment.startDate === segment.endDate
										? formatDateKeyDay(segment.startDate, locale)
										: t("widgets.absences.range", {
												start: formatDateKeyDay(segment.startDate, locale),
												end: formatDateKeyDay(segment.endDate, locale),
											}),
							)
							.join(", ");
						return (
							<li
								key={row.reviewerId}
								title={ranges}
								className="flex items-center gap-3"
							>
								<span className="min-w-0 flex-1">
									<span className="block truncate">
										{nameOf(row.reviewerId)}
									</span>
									{/* Large spells out the dates the strip only draws. */}
									<span
										className={
											size === "large"
												? "block text-xs text-pretty text-muted-foreground"
												: "sr-only"
										}
									>
										{ranges}
									</span>
								</span>
								<span aria-hidden="true" className="flex gap-[3px]">
									{days.map((day, index) => (
										<span
											key={day}
											className={cn(
												"h-3.5 w-4 rounded-[4px]",
												startsWeek(index) && "ml-1.5",
												row.segments.some(
													(segment) =>
														segment.startIndex <= index &&
														index <= segment.endIndex,
												)
													? "bg-amber-500/60"
													: "bg-muted",
											)}
										/>
									))}
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</WidgetFrame>
	);
}
