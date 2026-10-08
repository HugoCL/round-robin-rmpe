import { getLocalDateKeyYYYYMMDD, type Weekday } from "./reviewerAvailability";

/** Calendar date as `YYYY-MM-DD`, with no timezone attached. */
export type DateKey = string;

export type PlannedAbsenceStatus =
	| "scheduled"
	| "active"
	| "completed"
	| "cancelled";

export type DateKeyRange = { startDate: DateKey; endDate: DateKey };

export type AbsenceValidationError =
	| "invalidDate"
	| "invalidRange"
	| "startInPast"
	| "tooFarAhead"
	| "tooLong"
	| "overlap";

export const MAX_ABSENCE_LEAD_DAYS = 365;
export const MAX_ABSENCE_LENGTH_DAYS = 366;
/** UTC+14: the first timezone to reach any given calendar date. */
export const EARLIEST_TODAY_TIMEZONE = "Pacific/Kiritimati";
export const PLANNED_ABSENCE_ERROR_PREFIX = "PlannedAbsenceInvalid:";

const ABSENCE_VALIDATION_ERRORS: readonly AbsenceValidationError[] = [
	"invalidDate",
	"invalidRange",
	"startInPast",
	"tooFarAhead",
	"tooLong",
	"overlap",
];

const MS_PER_DAY = 86_400_000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Index matches `Date#getUTCDay()` (0 = Sunday).
const WEEKDAY_BY_UTC_DAY: readonly Weekday[] = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
];

function parseDateKeyToUtcMs(key: DateKey): number {
	const match = DATE_KEY_PATTERN.exec(key);
	if (!match) {
		throw new Error(`Invalid date key: ${key}`);
	}
	return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function utcMsToDateKey(ms: number): DateKey {
	const d = new Date(ms);
	const y = String(d.getUTCFullYear()).padStart(4, "0");
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function isValidDateKey(value: string): boolean {
	const match = DATE_KEY_PATTERN.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const d = new Date(Date.UTC(year, month - 1, day));
	return (
		d.getUTCFullYear() === year &&
		d.getUTCMonth() === month - 1 &&
		d.getUTCDate() === day
	);
}

/** Negative, zero or positive like a sort comparator (keys sort lexically). */
export function compareDateKeys(a: DateKey, b: DateKey): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

export function addDaysToDateKey(key: DateKey, days: number): DateKey {
	return utcMsToDateKey(parseDateKeyToUtcMs(key) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffInDays(from: DateKey, to: DateKey): number {
	return Math.round(
		(parseDateKeyToUtcMs(to) - parseDateKeyToUtcMs(from)) / MS_PER_DAY,
	);
}

export function dateKeyRangesOverlap(
	a: DateKeyRange,
	b: DateKeyRange,
): boolean {
	return (
		compareDateKeys(a.startDate, b.endDate) <= 0 &&
		compareDateKeys(b.startDate, a.endDate) <= 0
	);
}

/** Wall-clock time of `utcMs` in `timeZone`, expressed as if it were UTC. */
function getWallClockAsUtcMs(utcMs: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(utcMs));
	const read = (type: Intl.DateTimeFormatPartTypes): number => {
		const value = parts.find((p) => p.type === type)?.value;
		if (value === undefined) {
			throw new Error(`Unable to resolve ${type} in ${timeZone}`);
		}
		return Number(value);
	};
	return Date.UTC(
		read("year"),
		read("month") - 1,
		read("day"),
		read("hour"),
		read("minute"),
		read("second"),
	);
}

/** UTC instant (ms) of 00:00 on `key` in `timeZone`. */
export function zonedDateKeyToUtcMs(key: DateKey, timeZone: string): number {
	const guess = parseDateKeyToUtcMs(key);
	const firstOffset = getWallClockAsUtcMs(guess, timeZone) - guess;
	const first = guess - firstOffset;
	// The offset can differ at `first` when a DST change falls in between.
	const secondOffset = getWallClockAsUtcMs(first, timeZone) - first;
	return secondOffset === firstOffset ? first : guess - secondOffset;
}

/** The instant a reviewer is back: 00:00 the day after `endDate` in `timeZone`. */
export function getAbsenceReturnAt(endDate: DateKey, timeZone: string): number {
	return zonedDateKeyToUtcMs(addDaysToDateKey(endDate, 1), timeZone);
}

export function getTodayDateKey(now: number, timeZone: string): DateKey {
	return getLocalDateKeyYYYYMMDD(now, timeZone);
}

export function getWeekdayOfDateKey(key: DateKey): Weekday {
	return WEEKDAY_BY_UTC_DAY[new Date(parseDateKeyToUtcMs(key)).getUTCDay()];
}

function isWeekendDateKey(key: DateKey): boolean {
	const day = new Date(parseDateKeyToUtcMs(key)).getUTCDay();
	return day === 0 || day === 6;
}

/** Number of Monday-to-Friday days in `range`, inclusive. */
export function countWeekdaysInRange(range: DateKeyRange): number {
	let count = 0;
	for (
		let key = range.startDate;
		compareDateKeys(key, range.endDate) <= 0;
		key = addDaysToDateKey(key, 1)
	) {
		if (!isWeekendDateKey(key)) count += 1;
	}
	return count;
}

/** The first `weekdayCount` Monday-to-Friday days on or after `fromKey`. */
export function buildTimelineDays(
	fromKey: DateKey,
	weekdayCount: number,
): DateKey[] {
	const days: DateKey[] = [];
	let key = fromKey;
	while (days.length < weekdayCount) {
		if (!isWeekendDateKey(key)) days.push(key);
		key = addDaysToDateKey(key, 1);
	}
	return days;
}

export function absenceCoversDay(range: DateKeyRange, day: DateKey): boolean {
	return (
		compareDateKeys(range.startDate, day) <= 0 &&
		compareDateKeys(day, range.endDate) <= 0
	);
}

/** The reviewer's scheduled or active absence with the earliest start. */
export function findNextAbsence<
	T extends DateKeyRange & {
		reviewerId: string;
		status: PlannedAbsenceStatus;
	},
>(absences: readonly T[], reviewerId: string): T | null {
	let next: T | null = null;
	for (const absence of absences) {
		if (absence.reviewerId !== reviewerId) continue;
		if (absence.status !== "scheduled" && absence.status !== "active") {
			continue;
		}
		if (!next || compareDateKeys(absence.startDate, next.startDate) < 0) {
			next = absence;
		}
	}
	return next;
}

export function validateAbsenceRange(args: {
	range: DateKeyRange;
	todayKey: DateKey;
	existing: readonly DateKeyRange[];
}): AbsenceValidationError | null {
	const { range, todayKey, existing } = args;
	if (!isValidDateKey(range.startDate) || !isValidDateKey(range.endDate)) {
		return "invalidDate";
	}
	if (compareDateKeys(range.endDate, range.startDate) < 0) {
		return "invalidRange";
	}
	if (compareDateKeys(range.startDate, todayKey) < 0) {
		return "startInPast";
	}
	if (diffInDays(todayKey, range.startDate) > MAX_ABSENCE_LEAD_DAYS) {
		return "tooFarAhead";
	}
	if (
		diffInDays(range.startDate, range.endDate) + 1 >
		MAX_ABSENCE_LENGTH_DAYS
	) {
		return "tooLong";
	}
	if (existing.some((other) => dateKeyRangesOverlap(range, other))) {
		return "overlap";
	}
	return null;
}

export function plannedAbsenceErrorMessage(
	code: AbsenceValidationError,
): string {
	return `${PLANNED_ABSENCE_ERROR_PREFIX}${code}`;
}

/** Finds a `PlannedAbsenceInvalid:<code>` token anywhere in an Error message. */
export function parsePlannedAbsenceError(
	error: unknown,
): AbsenceValidationError | null {
	if (!(error instanceof Error)) return null;
	const start = error.message.indexOf(PLANNED_ABSENCE_ERROR_PREFIX);
	if (start === -1) return null;
	const rest = error.message.slice(start + PLANNED_ABSENCE_ERROR_PREFIX.length);
	const token = /^[A-Za-z]+/.exec(rest)?.[0];
	return ABSENCE_VALIDATION_ERRORS.find((code) => code === token) ?? null;
}
