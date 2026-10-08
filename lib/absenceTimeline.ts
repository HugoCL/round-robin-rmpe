import {
	absenceCoversDay,
	addDaysToDateKey,
	compareDateKeys,
	type DateKey,
	type DateKeyRange,
	getTodayDateKey,
	getWeekdayOfDateKey,
	type PlannedAbsenceStatus,
} from "./plannedAbsences";
import type { Weekday } from "./reviewerAvailability";

export interface TimelineReviewerInput {
	_id: string;
	manualIsAbsent: boolean;
	absentUntil?: number;
	excludedFromReviewPool?: boolean;
	partTimeSchedule?: { workingDays: readonly Weekday[] };
}

export interface TimelineAbsenceInput extends DateKeyRange {
	_id: string;
	reviewerId: string;
	status: PlannedAbsenceStatus;
}

export type TimelineBarKind = "planned" | "now";

export interface TimelineSegment<A extends TimelineAbsenceInput> {
	kind: TimelineBarKind;
	/** Inclusive indexes into the visible `days`. */
	startIndex: number;
	endIndex: number;
	/** The planned absence behind the bar, when there is one. */
	absence: A | null;
	/** First and last away day of the whole bar (it may extend past the window). */
	startDate: DateKey;
	endDate: DateKey | null;
	/** False when the bar continues from a weekday before the first column. */
	roundStart: boolean;
	/** False when the bar continues on the weekday after the last column. */
	roundEnd: boolean;
	/** An open-ended "away now" bar that runs to the window edge. */
	fadeEnd: boolean;
}

export interface TimelineRow<A extends TimelineAbsenceInput> {
	reviewerId: string;
	inPool: boolean;
	segments: TimelineSegment<A>[];
	/** Per day: not working that weekday (part-time) and not covered by a bar. */
	partTimeOff: boolean[];
	/**
	 * Per day: a new plan can start here. True from today on for days with no
	 * bar, and for days covered only by a manual absence (no plan behind it).
	 */
	plannable: boolean[];
}

export interface AbsenceTimeline<A extends TimelineAbsenceInput> {
	rows: TimelineRow<A>[];
	/** Per day: in-pool reviewers with no bar who are not off part-time. */
	available: number[];
	poolSize: number;
	/** `available[i]` at or below this is flagged as low. */
	lowThreshold: number;
}

interface DayBar<A> {
	kind: TimelineBarKind;
	absence: A | null;
	/** Last away day of the bar, or null when there is no return date. */
	endDate: DateKey | null;
}

const LOW_AVAILABILITY_RATIO = 0.6;

/** The weekday before `day`, skipping the weekend. */
function previousWeekday(day: DateKey): DateKey {
	return addDaysToDateKey(day, getWeekdayOfDateKey(day) === "monday" ? -3 : -1);
}

/** The weekday after `day`, skipping the weekend. */
function nextWeekday(day: DateKey): DateKey {
	return addDaysToDateKey(day, getWeekdayOfDateKey(day) === "friday" ? 3 : 1);
}

function isOffByPartTime(
	reviewer: TimelineReviewerInput,
	day: DateKey,
): boolean {
	const schedule = reviewer.partTimeSchedule;
	if (!schedule) return false;
	return !schedule.workingDays.includes(getWeekdayOfDateKey(day));
}

/**
 * Team-local last away day of a manual absence. `absentUntil` is the instant
 * the reviewer is back, so the day before that instant is the last full day
 * away. `null` means no return date.
 */
function manualAwayEnd(
	absentUntil: number | undefined,
	timeZone: string,
): DateKey | null {
	if (absentUntil === undefined) return null;
	return getTodayDateKey(absentUntil - 1, timeZone);
}

/**
 * Cell-by-cell layout of the team timeline. Every decision is made per
 * reviewer and calendar day, independent of the visible window, so a bar that
 * continues past either edge (or across a weekend) is never rounded there.
 */
export function buildAbsenceTimeline<A extends TimelineAbsenceInput>(args: {
	days: readonly DateKey[];
	todayKey: DateKey;
	timeZone: string;
	reviewers: readonly TimelineReviewerInput[];
	absences: readonly A[];
}): AbsenceTimeline<A> {
	const { days, todayKey, timeZone, reviewers, absences } = args;
	const live = absences.filter(
		(absence) => absence.status === "scheduled" || absence.status === "active",
	);

	const rows = reviewers.map((reviewer): TimelineRow<A> => {
		const own = live.filter((absence) => absence.reviewerId === reviewer._id);
		const manualEnd = reviewer.manualIsAbsent
			? manualAwayEnd(reviewer.absentUntil, timeZone)
			: null;

		// A plan always wins over the manual absence on the days it covers, so
		// its bar stays editable; an active plan keeps the "now" colouring.
		const barAt = (day: DateKey): DayBar<A> | null => {
			const active = own.find(
				(absence) =>
					absence.status === "active" && absenceCoversDay(absence, day),
			);
			const manualNow =
				reviewer.manualIsAbsent &&
				compareDateKeys(day, todayKey) >= 0 &&
				(manualEnd === null || compareDateKeys(day, manualEnd) <= 0);
			if (active) {
				const ends = [active.endDate, manualNow ? manualEnd : undefined]
					.filter((end): end is DateKey => typeof end === "string")
					.sort(compareDateKeys);
				return {
					kind: "now",
					absence: active,
					endDate:
						manualNow && manualEnd === null ? null : (ends.at(-1) ?? null),
				};
			}
			const scheduled = own.find(
				(absence) =>
					absence.status === "scheduled" && absenceCoversDay(absence, day),
			);
			if (scheduled) {
				return {
					kind: "planned",
					absence: scheduled,
					endDate: scheduled.endDate,
				};
			}
			if (manualNow) {
				return { kind: "now", absence: null, endDate: manualEnd };
			}
			return null;
		};

		// "now" bars join up regardless of their absence; planned ones per absence.
		const continuity = (bar: DayBar<A> | null) =>
			bar === null
				? null
				: bar.kind === "now"
					? "now"
					: `planned:${bar.absence?._id}`;
		const identity = (bar: DayBar<A> | null) =>
			bar === null ? null : `${bar.kind}:${bar.absence?._id ?? ""}`;

		const bars = days.map(barAt);
		const segments: TimelineSegment<A>[] = [];
		let index = 0;
		while (index < days.length) {
			const bar = bars[index];
			if (!bar) {
				index += 1;
				continue;
			}
			let end = index;
			while (
				end + 1 < days.length &&
				identity(bars[end + 1]) === identity(bar)
			) {
				end += 1;
			}
			const firstDay = days[index];
			const lastDay = days[end];
			const roundStart =
				continuity(barAt(previousWeekday(firstDay))) !== continuity(bar);
			const roundEnd =
				continuity(barAt(nextWeekday(lastDay))) !== continuity(bar);
			const lastBar = bars[end];
			segments.push({
				kind: bar.kind,
				startIndex: index,
				endIndex: end,
				absence: bar.absence,
				startDate: bar.absence?.startDate ?? todayKey,
				endDate: lastBar?.endDate ?? null,
				roundStart,
				roundEnd,
				fadeEnd:
					end === days.length - 1 &&
					lastBar?.kind === "now" &&
					lastBar.endDate === null,
			});
			index = end + 1;
		}

		return {
			reviewerId: reviewer._id,
			inPool: reviewer.excludedFromReviewPool !== true,
			segments,
			partTimeOff: days.map(
				(day, i) => bars[i] === null && isOffByPartTime(reviewer, day),
			),
			plannable: days.map((day, i) => {
				if (compareDateKeys(day, todayKey) < 0) return false;
				const bar = bars[i];
				return bar === null || (bar.kind === "now" && bar.absence === null);
			}),
		};
	});

	const pooled = rows.filter((row) => row.inPool);
	const available = days.map(
		(_, dayIndex) =>
			pooled.filter(
				(row) =>
					!row.segments.some(
						(segment) =>
							segment.startIndex <= dayIndex && dayIndex <= segment.endIndex,
					) && !row.partTimeOff[dayIndex],
			).length,
	);
	const poolSize = pooled.length;
	return {
		rows,
		available,
		poolSize,
		lowThreshold: Math.floor(poolSize * LOW_AVAILABILITY_RATIO),
	};
}
