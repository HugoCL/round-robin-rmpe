"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { Doc } from "@/convex/_generated/dataModel";
import {
	buildAbsenceTimeline,
	type TimelineSegment,
} from "@/lib/absenceTimeline";
import {
	addDaysToDateKey,
	buildTimelineDays,
	compareDateKeys,
	type DateKey,
	type DateKeyRange,
	getTodayDateKey,
	getWeekdayOfDateKey,
} from "@/lib/plannedAbsences";
import type { Reviewer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePRReview } from "../PRReviewContext";
import { formatDateKeyDay, MarkAbsentDialog } from "./MarkAbsentDialog";

const WEEKDAY_COUNT = 15;
/** Three calendar weeks: exactly 15 weekdays. */
const PAGE_SHIFT_DAYS = 21;
const GRID_COLUMNS = `minmax(7rem,9rem) repeat(${WEEKDAY_COUNT}, minmax(2.25rem,1fr))`;

type Absence = Doc<"reviewerAbsences">;
type Segment = TimelineSegment<Absence>;

interface SelectedAbsenceTarget {
	reviewer: Reviewer;
	absence?: Absence;
	initialRange?: DateKeyRange;
}

function mondayOfWeek(key: DateKey): DateKey {
	const offsets = {
		monday: 0,
		tuesday: 1,
		wednesday: 2,
		thursday: 3,
		friday: 4,
		saturday: 5,
		sunday: 6,
	} as const;
	return addDaysToDateKey(key, -offsets[getWeekdayOfDateKey(key)]);
}

function dateKeyDayNumber(key: DateKey): number {
	return Number(key.slice(8, 10));
}

const PART_TIME_OFF_CLASS =
	"bg-[repeating-linear-gradient(135deg,transparent_0_4px,color-mix(in_oklab,var(--muted-foreground)_16%,transparent)_4px_8px)]";

const BAR_BASE_CLASS =
	"relative z-[1] my-1.5 min-w-0 self-stretch outline-offset-2 transition-colors";

export function TeamAbsencesDialog({ trigger }: { trigger: React.ReactNode }) {
	const t = useTranslations();
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<span className="inline-flex">{trigger}</span>
			</DialogTrigger>
			<DialogContent className="sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle>{t("absenceTimeline.title")}</DialogTitle>
					<DialogDescription>
						{t("absenceTimeline.description")}
					</DialogDescription>
				</DialogHeader>
				{/* The content unmounts on close, so every open starts on today. */}
				<TeamAbsencesTimeline />
			</DialogContent>
		</Dialog>
	);
}

function TeamAbsencesTimeline() {
	const t = useTranslations();
	const locale = useLocale();
	const {
		reviewers,
		plannedAbsences,
		teamTimezone,
		canManageCurrentTeam,
		userInfo,
		onMarkAbsent,
	} = usePRReview();
	const [now] = useState(() => Date.now());
	const todayKey = getTodayDateKey(now, teamTimezone);
	const [windowStart, setWindowStart] = useState<DateKey>(todayKey);
	const [selected, setSelected] = useState<SelectedAbsenceTarget | null>(null);

	const days = useMemo(
		() => buildTimelineDays(windowStart, WEEKDAY_COUNT),
		[windowStart],
	);
	const timeline = useMemo(
		() =>
			buildAbsenceTimeline({
				days,
				todayKey,
				timeZone: teamTimezone,
				reviewers,
				absences: plannedAbsences,
			}),
		[days, todayKey, teamTimezone, reviewers, plannedAbsences],
	);

	const weekdayFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }),
		[locale],
	);
	const monthFormatter = useMemo(
		() => new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short" }),
		[locale],
	);
	const toUtcDate = (key: DateKey) => {
		const [year, month, day] = key.split("-").map(Number);
		return new Date(Date.UTC(year, month - 1, day));
	};

	const earliestStart = mondayOfWeek(todayKey);
	const previousStart = addDaysToDateKey(windowStart, -PAGE_SHIFT_DAYS);
	const canGoBack = compareDateKeys(previousStart, earliestStart) >= 0;

	const rangeLabel = t("absenceTimeline.rangeLabel", {
		start: formatDateKeyDay(days[0], locale),
		end: formatDateKeyDay(days[days.length - 1], locale),
	});

	const lowDayCount = timeline.lowThreshold;

	return (
		<div className="grid min-w-0 gap-3">
			<div className="flex items-center justify-between gap-2">
				<p className="text-sm font-medium tabular-nums">{rangeLabel}</p>
				<div className="flex items-center gap-1">
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						aria-label={t("absenceTimeline.previous")}
						disabled={!canGoBack}
						onClick={() => setWindowStart(previousStart)}
					>
						<ChevronLeft />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						aria-label={t("absenceTimeline.next")}
						onClick={() =>
							setWindowStart(addDaysToDateKey(windowStart, PAGE_SHIFT_DAYS))
						}
					>
						<ChevronRight />
					</Button>
				</div>
			</div>

			{reviewers.length === 0 ? (
				<p className="py-6 text-center text-sm text-muted-foreground">
					{t("absenceTimeline.empty")}
				</p>
			) : (
				<div className="overflow-x-auto">
					<div className="min-w-[42rem]">
						<div
							className="grid items-end border-b"
							style={{ gridTemplateColumns: GRID_COLUMNS }}
						>
							<div className="sticky left-0 z-10 bg-background" />
							{days.map((day, index) => {
								const isToday = day === todayKey;
								const date = toUtcDate(day);
								const showMonth =
									index === 0 ||
									days[index - 1].slice(5, 7) !== day.slice(5, 7);
								return (
									<div
										key={day}
										className={cn(
											"flex flex-col items-center gap-0.5 pb-1.5 text-[11px] leading-none text-muted-foreground",
											getWeekdayOfDateKey(day) === "monday" &&
												index > 0 &&
												"border-l",
										)}
									>
										<span className="h-3 text-[10px] uppercase tracking-wide">
											{showMonth ? monthFormatter.format(date) : ""}
										</span>
										<span>{weekdayFormatter.format(date)}</span>
										<span
											className={cn(
												"inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
												isToday
													? "bg-primary text-primary-foreground"
													: "text-foreground",
											)}
											aria-current={isToday ? "date" : undefined}
										>
											{dateKeyDayNumber(day)}
										</span>
									</div>
								);
							})}
						</div>

						{timeline.rows.map((row, rowIndex) => {
							const reviewer = reviewers[rowIndex];
							return (
								<div
									key={row.reviewerId}
									className={cn(
										"grid items-stretch border-b",
										!row.inPool && "opacity-60",
									)}
									style={{ gridTemplateColumns: GRID_COLUMNS }}
								>
									<div className="sticky left-0 z-10 flex min-w-0 items-center bg-background pr-2 text-sm">
										<span className="truncate">{reviewer.name}</span>
									</div>
									{days.map((day, index) => {
										const style = { gridColumn: index + 2, gridRow: 1 };
										const cellClass = cn(
											"h-9",
											getWeekdayOfDateKey(day) === "monday" &&
												index > 0 &&
												"border-l",
											row.partTimeOff[index] && PART_TIME_OFF_CLASS,
										);
										const covered = row.segments.some(
											(segment) =>
												segment.startIndex <= index &&
												index <= segment.endIndex,
										);
										const canPlan =
											canManageCurrentTeam &&
											!covered &&
											compareDateKeys(day, todayKey) >= 0;
										if (!canPlan) {
											return (
												<div key={day} style={style} className={cellClass} />
											);
										}
										return (
											<button
												key={day}
												type="button"
												style={style}
												className={cn(
													cellClass,
													"cursor-pointer transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
												)}
												aria-label={t("absenceTimeline.cellLabel", {
													name: reviewer.name,
													date: formatDateKeyDay(day, locale),
												})}
												onClick={() =>
													setSelected({
														reviewer,
														initialRange: { startDate: day, endDate: day },
													})
												}
											/>
										);
									})}
									{row.segments.map((segment) => (
										<TimelineBar
											key={`${segment.startIndex}-${segment.absence?._id ?? "manual"}`}
											segment={segment}
											name={reviewer.name}
											locale={locale}
											lastDay={days[segment.endIndex]}
											interactive={
												canManageCurrentTeam && segment.absence !== null
											}
											onSelect={() =>
												setSelected({
													reviewer,
													absence: segment.absence ?? undefined,
												})
											}
										/>
									))}
								</div>
							);
						})}

						<div
							className="grid items-center py-1.5"
							style={{ gridTemplateColumns: GRID_COLUMNS }}
						>
							<div className="sticky left-0 z-10 bg-background pr-2 text-sm font-medium">
								{t("absenceTimeline.available")}
							</div>
							{timeline.available.map((count, index) => {
								const low = count <= lowDayCount && timeline.poolSize > 0;
								return (
									<div
										key={days[index]}
										className={cn(
											"text-center text-sm tabular-nums",
											getWeekdayOfDateKey(days[index]) === "monday" &&
												index > 0 &&
												"border-l",
											low
												? "font-semibold text-destructive"
												: "text-muted-foreground",
										)}
									>
										{count}
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}

			<ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
				<LegendItem
					swatchClass="bg-primary"
					label={t("absenceTimeline.legendNow")}
				/>
				<LegendItem
					swatchClass="bg-amber-500/80"
					label={t("absenceTimeline.legendPlanned")}
				/>
				<LegendItem
					swatchClass={cn("border", PART_TIME_OFF_CLASS)}
					label={t("absenceTimeline.legendPartTime")}
				/>
				<li className="flex items-center gap-1.5">
					<span
						className="font-semibold text-destructive tabular-nums"
						aria-hidden="true"
					>
						#
					</span>
					{t("absenceTimeline.legendLow")}
				</li>
			</ul>

			{selected ? (
				<MarkAbsentDialog
					isOpen
					onOpenChange={(open) => {
						if (!open) setSelected(null);
					}}
					reviewer={selected.reviewer}
					currentUser={userInfo}
					onMarkAbsent={async (absentUntil) => {
						await onMarkAbsent(selected.reviewer._id, absentUntil);
					}}
					absence={selected.absence}
					initialMode={selected.initialRange ? "plan" : undefined}
					initialRange={selected.initialRange}
				/>
			) : null}
		</div>
	);
}

function LegendItem({
	swatchClass,
	label,
}: {
	swatchClass: string;
	label: string;
}) {
	return (
		<li className="flex items-center gap-1.5">
			<span
				className={cn("inline-block h-3 w-5 rounded-sm", swatchClass)}
				aria-hidden="true"
			/>
			{label}
		</li>
	);
}

function TimelineBar({
	segment,
	name,
	locale,
	lastDay,
	interactive,
	onSelect,
}: {
	segment: Segment;
	name: string;
	locale: string;
	lastDay: DateKey;
	interactive: boolean;
	onSelect: () => void;
}) {
	const t = useTranslations();
	const label = t("absenceTimeline.barLabel", {
		name,
		start: formatDateKeyDay(segment.startDate, locale),
		end: formatDateKeyDay(segment.endDate ?? lastDay, locale),
	});
	const className = cn(
		BAR_BASE_CLASS,
		segment.kind === "now" ? "bg-primary" : "bg-amber-500/80",
		segment.roundStart && "rounded-l-md",
		segment.roundEnd && "rounded-r-md",
		segment.fadeEnd &&
			"[mask-image:linear-gradient(to_right,black_calc(100%_-_4rem),transparent)]",
	);
	const style = {
		gridColumn: `${segment.startIndex + 2} / ${segment.endIndex + 3}`,
		gridRow: 1,
	};

	if (!interactive) {
		return (
			<div role="img" aria-label={label} style={style} className={className} />
		);
	}
	return (
		<button
			type="button"
			aria-label={label}
			style={style}
			className={cn(
				className,
				"cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring",
			)}
			onClick={onSelect}
		/>
	);
}
