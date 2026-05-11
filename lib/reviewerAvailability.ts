export const DEFAULT_TEAM_TIMEZONE = "America/Santiago";

export const WEEKDAY_VALUES = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
] as const;

export const WORKDAY_VALUES = WEEKDAY_VALUES.slice(0, 5);

export type Weekday = (typeof WEEKDAY_VALUES)[number];

export type PartTimeSchedule = {
	workingDays: Weekday[];
};

export type AbsenceReason = "manual" | "part_time_schedule" | null;

export type ReviewerAvailability = {
	manualIsAbsent: boolean;
	isOffTodayBySchedule: boolean;
	effectiveIsAbsent: boolean;
	absenceReason: AbsenceReason;
};

type ReviewerAvailabilityInput = {
	isAbsent: boolean;
	partTimeSchedule?: PartTimeSchedule;
};

export function isWeekday(value: string): value is Weekday {
	return WEEKDAY_VALUES.includes(value as Weekday);
}

export function normalizeWorkingDays(
	workingDays: readonly Weekday[] | undefined,
): Weekday[] {
	if (!workingDays || workingDays.length === 0) {
		return [];
	}

	const uniqueDays = new Set<Weekday>();
	for (const day of workingDays) {
		if (isWeekday(day)) {
			uniqueDays.add(day);
		}
	}

	return WORKDAY_VALUES.filter((day) => uniqueDays.has(day));
}

export function normalizePartTimeSchedule(
	partTimeSchedule?: PartTimeSchedule,
): PartTimeSchedule | undefined {
	if (!partTimeSchedule) {
		return undefined;
	}

	const workingDays = normalizeWorkingDays(partTimeSchedule.workingDays);
	if (workingDays.length === 0) {
		return undefined;
	}

	return { workingDays };
}

export function isValidTimezone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
		return true;
	} catch {
		return false;
	}
}

export function resolveTeamTimezone(timeZone?: string | null): string {
	if (!timeZone) {
		return DEFAULT_TEAM_TIMEZONE;
	}

	return isValidTimezone(timeZone) ? timeZone : DEFAULT_TEAM_TIMEZONE;
}

export function getWeekdayInTimezone(
	now: number | Date,
	timeZone: string,
): Weekday {
	const date = typeof now === "number" ? new Date(now) : now;
	const weekday = new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		timeZone,
	})
		.format(date)
		.toLowerCase();

	if (!isWeekday(weekday)) {
		throw new Error(`Unsupported weekday value: ${weekday}`);
	}

	return weekday;
}

export function getReviewerAvailability(
	reviewer: ReviewerAvailabilityInput,
	timeZone: string,
	now: number = Date.now(),
): ReviewerAvailability {
	const manualIsAbsent = reviewer.isAbsent;
	const schedule = normalizePartTimeSchedule(reviewer.partTimeSchedule);
	const today = getWeekdayInTimezone(now, timeZone);
	const isOffTodayBySchedule = schedule
		? !schedule.workingDays.includes(today)
		: false;
	const effectiveIsAbsent = manualIsAbsent || isOffTodayBySchedule;
	const absenceReason: AbsenceReason = manualIsAbsent
		? "manual"
		: isOffTodayBySchedule
			? "part_time_schedule"
			: null;

	return {
		manualIsAbsent,
		isOffTodayBySchedule,
		effectiveIsAbsent,
		absenceReason,
	};
}

/** Calendar month (1–12) and day (1–31) in IANA `timeZone` at `nowMs`. */
export function getMonthDayInTimeZone(
	nowMs: number,
	timeZone: string,
): { month: number; day: number } {
	const d = new Date(nowMs);
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		month: "numeric",
		day: "numeric",
	}).formatToParts(d);
	const month = Number(parts.find((p) => p.type === "month")?.value);
	const day = Number(parts.find((p) => p.type === "day")?.value);
	if (!Number.isFinite(month) || !Number.isFinite(day)) {
		throw new Error(`Unable to resolve month/day in ${timeZone}`);
	}
	return { month, day };
}

/** Local calendar date as `YYYY-MM-DD` in IANA `timeZone` at `nowMs`. */
export function getLocalDateKeyYYYYMMDD(
	nowMs: number,
	timeZone: string,
): string {
	const d = new Date(nowMs);
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(d);
	const y = parts.find((p) => p.type === "year")?.value;
	const m = parts.find((p) => p.type === "month")?.value;
	const day = parts.find((p) => p.type === "day")?.value;
	if (!y || !m || !day) {
		throw new Error(`Unable to resolve local date in ${timeZone}`);
	}
	return `${y}-${m}-${day}`;
}

/** Local hour (0–23) in IANA `timeZone` at `nowMs`. */
export function getLocalHourInTimeZone(
	nowMs: number,
	timeZone: string,
): number {
	const d = new Date(nowMs);
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone,
		hour: "2-digit",
		hour12: false,
	}).formatToParts(d);
	const h = parts.find((p) => p.type === "hour")?.value;
	return h ? Number.parseInt(h, 10) : 0;
}

/** Whether `month`/`day` is a real calendar date (uses 2024 so Feb 29 is valid). */
export function isValidCalendarBirthday(month: number, day: number): boolean {
	if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
	if (month < 1 || month > 12 || day < 1 || day > 31) return false;
	const d = new Date(2024, month - 1, day);
	return (
		d.getFullYear() === 2024 &&
		d.getMonth() === month - 1 &&
		d.getDate() === day
	);
}

export function reviewerHasBirthdayToday(
	reviewer: { birthdayMonth?: number; birthdayDay?: number },
	teamTimeZone: string,
	nowMs: number = Date.now(),
): boolean {
	if (
		reviewer.birthdayMonth === undefined ||
		reviewer.birthdayDay === undefined
	) {
		return false;
	}
	const { month, day } = getMonthDayInTimeZone(nowMs, teamTimeZone);
	return reviewer.birthdayMonth === month && reviewer.birthdayDay === day;
}
