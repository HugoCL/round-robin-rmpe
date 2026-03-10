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
