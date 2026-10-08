import assert from "node:assert/strict";
import test from "node:test";
import {
	absenceCoversDay,
	addDaysToDateKey,
	buildTimelineDays,
	compareDateKeys,
	countWeekdaysInRange,
	dateKeyRangesOverlap,
	diffInDays,
	findNextAbsence,
	findNextScheduledAbsence,
	getAbsenceReturnAt,
	getTodayDateKey,
	getWeekdayOfDateKey,
	isValidDateKey,
	parsePlannedAbsenceError,
	plannedAbsenceErrorMessage,
	resolveAbsenceSubmit,
	resolveActivatedAbsentUntil,
	resolveUpdatedAbsentUntil,
	validateAbsenceRange,
	zonedDateKeyToUtcMs,
} from "../../lib/plannedAbsences";

test("isValidDateKey accepts real calendar dates only", () => {
	assert.equal(isValidDateKey("2026-10-19"), true);
	assert.equal(isValidDateKey("2028-02-29"), true);
	assert.equal(isValidDateKey("2026-02-30"), false);
	assert.equal(isValidDateKey("2026-1-5"), false);
	assert.equal(isValidDateKey(""), false);
});

test("date key arithmetic crosses month, year and leap boundaries", () => {
	assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01");
	assert.equal(addDaysToDateKey("2028-02-28", 1), "2028-02-29");
	assert.equal(addDaysToDateKey("2026-10-19", -19), "2026-09-30");
	assert.equal(diffInDays("2026-10-19", "2026-10-23"), 4);
	assert.equal(diffInDays("2026-10-23", "2026-10-19"), -4);
	assert.ok(compareDateKeys("2026-10-19", "2026-10-23") < 0);
	assert.equal(compareDateKeys("2026-10-19", "2026-10-19"), 0);
	assert.ok(compareDateKeys("2026-10-23", "2026-10-19") > 0);
});

test("dateKeyRangesOverlap treats shared days as overlapping", () => {
	const a = { startDate: "2026-10-19", endDate: "2026-10-23" };
	assert.equal(
		dateKeyRangesOverlap(a, { startDate: "2026-10-23", endDate: "2026-10-25" }),
		true,
	);
	assert.equal(
		dateKeyRangesOverlap(a, { startDate: "2026-10-24", endDate: "2026-10-25" }),
		false,
	);
});

test("zonedDateKeyToUtcMs resolves local midnight across offsets and DST", () => {
	assert.equal(
		zonedDateKeyToUtcMs("2026-10-24", "America/Santiago"),
		Date.UTC(2026, 9, 24, 3),
	);
	assert.equal(
		zonedDateKeyToUtcMs("2026-03-30", "Europe/Madrid"),
		Date.UTC(2026, 2, 29, 22),
	);
	assert.equal(zonedDateKeyToUtcMs("2026-01-10", "UTC"), Date.UTC(2026, 0, 10));
});

test("zonedDateKeyToUtcMs lands on the first instant of a day whose midnight is skipped", () => {
	// Santiago springs forward on 2026-09-06: 00:00 jumps straight to 01:00.
	const ms = zonedDateKeyToUtcMs("2026-09-06", "America/Santiago");
	assert.equal(ms, Date.UTC(2026, 8, 6, 4));
	assert.equal(getTodayDateKey(ms, "America/Santiago"), "2026-09-06");
	assert.equal(getTodayDateKey(ms - 1, "America/Santiago"), "2026-09-05");
});

test("zonedDateKeyToUtcMs lands on the first instant of a fall-back day", () => {
	// Santiago falls back on 2026-04-04 at 24:00 (23:00 repeats), so the clock
	// reads 23:00 twice on 04-04; midnight of 04-05 happens once, at UTC-4.
	const ms = zonedDateKeyToUtcMs("2026-04-05", "America/Santiago");
	assert.equal(ms, Date.UTC(2026, 3, 5, 4));
	assert.equal(getTodayDateKey(ms, "America/Santiago"), "2026-04-05");
	assert.equal(getTodayDateKey(ms - 1, "America/Santiago"), "2026-04-04");
});

test("getAbsenceReturnAt is local midnight the day after the last absent day", () => {
	assert.equal(
		getAbsenceReturnAt("2026-10-23", "America/Santiago"),
		Date.UTC(2026, 9, 24, 3),
	);
});

test("getTodayDateKey reads the calendar date in the given timezone", () => {
	assert.equal(
		getTodayDateKey(Date.UTC(2026, 9, 8, 2), "America/Santiago"),
		"2026-10-07",
	);
});

test("weekday helpers ignore weekends", () => {
	assert.equal(getWeekdayOfDateKey("2026-10-19"), "monday");
	assert.equal(getWeekdayOfDateKey("2026-10-25"), "sunday");
	assert.equal(
		countWeekdaysInRange({ startDate: "2026-10-19", endDate: "2026-10-25" }),
		5,
	);
});

test("buildTimelineDays yields the next weekdays and skips weekends", () => {
	assert.deepEqual(buildTimelineDays("2026-10-08", 5), [
		"2026-10-08",
		"2026-10-09",
		"2026-10-12",
		"2026-10-13",
		"2026-10-14",
	]);
	assert.equal(buildTimelineDays("2026-10-10", 3)[0], "2026-10-12");
});

test("absenceCoversDay is inclusive on both ends", () => {
	const range = { startDate: "2026-10-19", endDate: "2026-10-23" };
	assert.equal(absenceCoversDay(range, "2026-10-19"), true);
	assert.equal(absenceCoversDay(range, "2026-10-23"), true);
	assert.equal(absenceCoversDay(range, "2026-10-18"), false);
	assert.equal(absenceCoversDay(range, "2026-10-24"), false);
});

test("findNextAbsence picks the earliest live absence of that reviewer", () => {
	const absences = [
		{
			reviewerId: "a",
			status: "completed" as const,
			startDate: "2026-09-01",
			endDate: "2026-09-02",
		},
		{
			reviewerId: "a",
			status: "cancelled" as const,
			startDate: "2026-09-10",
			endDate: "2026-09-11",
		},
		{
			reviewerId: "b",
			status: "scheduled" as const,
			startDate: "2026-10-01",
			endDate: "2026-10-02",
		},
		{
			reviewerId: "a",
			status: "scheduled" as const,
			startDate: "2026-11-10",
			endDate: "2026-11-12",
		},
		{
			reviewerId: "a",
			status: "active" as const,
			startDate: "2026-10-20",
			endDate: "2026-10-22",
		},
	];
	assert.equal(findNextAbsence(absences, "a")?.startDate, "2026-10-20");
	assert.equal(findNextAbsence(absences, "zzz"), null);
});

test("findNextScheduledAbsence skips the active absence for the next scheduled one", () => {
	const absences = [
		{
			reviewerId: "a",
			status: "active" as const,
			startDate: "2026-10-05",
			endDate: "2026-10-09",
		},
		{
			reviewerId: "a",
			status: "scheduled" as const,
			startDate: "2026-12-01",
			endDate: "2026-12-04",
		},
		{
			reviewerId: "a",
			status: "scheduled" as const,
			startDate: "2026-11-10",
			endDate: "2026-11-12",
		},
		{
			reviewerId: "a",
			status: "completed" as const,
			startDate: "2026-09-01",
			endDate: "2026-09-02",
		},
		{
			reviewerId: "b",
			status: "scheduled" as const,
			startDate: "2026-10-12",
			endDate: "2026-10-13",
		},
	];
	assert.equal(
		findNextScheduledAbsence(absences, "a")?.startDate,
		"2026-11-10",
	);
	assert.equal(findNextAbsence(absences, "a")?.status, "active");
	assert.equal(findNextScheduledAbsence(absences, "zzz"), null);
	assert.equal(findNextScheduledAbsence(absences.slice(0, 1), "a"), null);
});

test("validateAbsenceRange accepts the exact lead and length limits", () => {
	const todayKey = "2026-10-08";
	const lastStart = addDaysToDateKey(todayKey, 365);
	assert.equal(
		validateAbsenceRange({
			range: { startDate: lastStart, endDate: lastStart },
			todayKey,
			existing: [],
		}),
		null,
	);
	assert.equal(
		validateAbsenceRange({
			range: {
				startDate: addDaysToDateKey(todayKey, 366),
				endDate: addDaysToDateKey(todayKey, 366),
			},
			todayKey,
			existing: [],
		}),
		"tooFarAhead",
	);
	// 366 days inclusive: today through today + 365.
	assert.equal(
		validateAbsenceRange({
			range: {
				startDate: todayKey,
				endDate: addDaysToDateKey(todayKey, 365),
			},
			todayKey,
			existing: [],
		}),
		null,
	);
});

test("validateAbsenceRange reports the first failing rule", () => {
	const todayKey = "2026-10-08";
	const existing = [{ startDate: "2026-10-19", endDate: "2026-10-23" }];
	assert.equal(
		validateAbsenceRange({
			range: { startDate: "2026-02-30", endDate: "2026-03-01" },
			todayKey,
			existing,
		}),
		"invalidDate",
	);
	assert.equal(
		validateAbsenceRange({
			range: { startDate: "2026-10-07", endDate: "2026-10-09" },
			todayKey,
			existing,
		}),
		"startInPast",
	);
	assert.equal(
		validateAbsenceRange({
			range: { startDate: "2026-10-12", endDate: "2026-10-09" },
			todayKey,
			existing,
		}),
		"invalidRange",
	);
	assert.equal(
		validateAbsenceRange({
			range: { startDate: "2027-10-09", endDate: "2027-10-10" },
			todayKey,
			existing,
		}),
		"tooFarAhead",
	);
	assert.equal(
		validateAbsenceRange({
			range: {
				startDate: "2026-10-08",
				endDate: addDaysToDateKey("2026-10-08", 366),
			},
			todayKey,
			existing: [],
		}),
		"tooLong",
	);
	assert.equal(
		validateAbsenceRange({
			range: { startDate: "2026-10-22", endDate: "2026-10-26" },
			todayKey,
			existing,
		}),
		"overlap",
	);
	assert.equal(
		validateAbsenceRange({
			range: { startDate: "2026-10-08", endDate: "2026-10-08" },
			todayKey,
			existing,
		}),
		null,
	);
});

test("planned absence errors round-trip through wrapped Convex messages", () => {
	assert.equal(
		plannedAbsenceErrorMessage("overlap"),
		"PlannedAbsenceInvalid:overlap",
	);
	assert.equal(
		parsePlannedAbsenceError(
			new Error("Uncaught Error: PlannedAbsenceInvalid:overlap\n at ..."),
		),
		"overlap",
	);
	assert.equal(
		parsePlannedAbsenceError(new Error("PlannedAbsenceInvalid:bogus")),
		null,
	);
	assert.equal(parsePlannedAbsenceError(new Error("boom")), null);
	assert.equal(parsePlannedAbsenceError("PlannedAbsenceInvalid:overlap"), null);
});

test("resolveActivatedAbsentUntil decides expiry and the stored return time", () => {
	const now = 1_000;
	assert.deepEqual(
		resolveActivatedAbsentUntil({
			isAbsent: false,
			absentUntil: undefined,
			returnAt: 1_000,
			now,
		}),
		{ kind: "expired" },
	);
	assert.deepEqual(
		resolveActivatedAbsentUntil({
			isAbsent: false,
			absentUntil: undefined,
			returnAt: 5_000,
			now,
		}),
		{ kind: "activate", absentUntil: 5_000 },
	);
	assert.deepEqual(
		resolveActivatedAbsentUntil({
			isAbsent: true,
			absentUntil: undefined,
			returnAt: 5_000,
			now,
		}),
		{ kind: "activate", absentUntil: undefined },
	);
	assert.deepEqual(
		resolveActivatedAbsentUntil({
			isAbsent: true,
			absentUntil: 9_000,
			returnAt: 5_000,
			now,
		}),
		{ kind: "activate", absentUntil: 9_000 },
	);
	assert.deepEqual(
		resolveActivatedAbsentUntil({
			isAbsent: true,
			absentUntil: 3_000,
			returnAt: 5_000,
			now,
		}),
		{ kind: "activate", absentUntil: 5_000 },
	);
});

test("resolveUpdatedAbsentUntil only moves a return time the plan governs", () => {
	// Governed by the plan: follows the new end date.
	assert.equal(
		resolveUpdatedAbsentUntil({
			isAbsent: true,
			absentUntil: 5_000,
			previousReturnAt: 5_000,
			nextReturnAt: 8_000,
		}),
		8_000,
	);
	assert.equal(
		resolveUpdatedAbsentUntil({
			isAbsent: true,
			absentUntil: 5_000,
			previousReturnAt: 5_000,
			nextReturnAt: 3_000,
		}),
		3_000,
	);
	// Longer manual absence: never shortened.
	assert.equal(
		resolveUpdatedAbsentUntil({
			isAbsent: true,
			absentUntil: 9_000,
			previousReturnAt: 5_000,
			nextReturnAt: 3_000,
		}),
		9_000,
	);
	assert.equal(
		resolveUpdatedAbsentUntil({
			isAbsent: true,
			absentUntil: 9_000,
			previousReturnAt: 5_000,
			nextReturnAt: 12_000,
		}),
		12_000,
	);
	// Shorter than the plan (not normally reachable): still never shortened.
	assert.equal(
		resolveUpdatedAbsentUntil({
			isAbsent: true,
			absentUntil: 4_000,
			previousReturnAt: 5_000,
			nextReturnAt: 3_000,
		}),
		4_000,
	);
	// Indefinite or not absent: leave the reviewer alone.
	assert.equal(
		resolveUpdatedAbsentUntil({
			isAbsent: true,
			absentUntil: undefined,
			previousReturnAt: 5_000,
			nextReturnAt: 8_000,
		}),
		null,
	);
	assert.equal(
		resolveUpdatedAbsentUntil({
			isAbsent: false,
			absentUntil: 5_000,
			previousReturnAt: 5_000,
			nextReturnAt: 8_000,
		}),
		null,
	);
});

test("resolveAbsenceSubmit marks absent without a return date when indefinite", () => {
	const now = Date.parse("2026-10-19T15:00:00Z");
	const range = { startDate: "2026-10-19", endDate: "2026-10-19" };
	assert.deepEqual(
		resolveAbsenceSubmit({
			range,
			todayKey: "2026-10-19",
			indefinite: true,
			teamTimezone: "America/Santiago",
			now,
		}),
		{ kind: "now", absentUntil: undefined },
	);
});

test("resolveAbsenceSubmit returns today at the team-timezone wall clock time", () => {
	// 2026-10-19 12:00 in Santiago (UTC-3 in October).
	const now = Date.parse("2026-10-19T15:00:00Z");
	const range = { startDate: "2026-10-19", endDate: "2026-10-19" };
	assert.deepEqual(
		resolveAbsenceSubmit({
			range,
			todayKey: "2026-10-19",
			indefinite: false,
			returnTodayAt: "18:30",
			teamTimezone: "America/Santiago",
			now,
		}),
		{ kind: "now", absentUntil: Date.parse("2026-10-19T21:30:00Z") },
	);
});

test("resolveAbsenceSubmit rejects a return time that already passed", () => {
	const now = Date.parse("2026-10-19T15:00:00Z");
	const range = { startDate: "2026-10-19", endDate: "2026-10-19" };
	const base = {
		range,
		todayKey: "2026-10-19",
		indefinite: false,
		teamTimezone: "America/Santiago",
		now,
	};
	assert.deepEqual(resolveAbsenceSubmit({ ...base, returnTodayAt: "11:59" }), {
		kind: "error",
		code: "returnTimePassed",
	});
	assert.deepEqual(resolveAbsenceSubmit({ ...base, returnTodayAt: "12:00" }), {
		kind: "error",
		code: "returnTimePassed",
	});
	assert.deepEqual(resolveAbsenceSubmit({ ...base, returnTodayAt: "" }), {
		kind: "error",
		code: "returnTimeMissing",
	});
});

test("resolveAbsenceSubmit only returns later today for a single-day range", () => {
	const now = Date.parse("2026-10-19T15:00:00Z");
	assert.deepEqual(
		resolveAbsenceSubmit({
			range: { startDate: "2026-10-19", endDate: "2026-10-21" },
			todayKey: "2026-10-19",
			indefinite: false,
			returnTodayAt: "18:30",
			teamTimezone: "America/Santiago",
			now,
		}),
		{ kind: "error", code: "returnNotToday" },
	);
});

test("resolveAbsenceSubmit plans any other range, including one starting today", () => {
	const now = Date.parse("2026-10-19T15:00:00Z");
	const today = { startDate: "2026-10-19", endDate: "2026-10-23" };
	const future = { startDate: "2026-10-26", endDate: "2026-10-30" };
	const base = {
		todayKey: "2026-10-19",
		indefinite: false,
		teamTimezone: "America/Santiago",
		now,
	};
	assert.deepEqual(resolveAbsenceSubmit({ ...base, range: today }), {
		kind: "plan",
		range: today,
	});
	// Options never apply to a future start, even if stale state says so.
	assert.deepEqual(
		resolveAbsenceSubmit({
			...base,
			range: future,
			indefinite: true,
			returnTodayAt: "18:30",
		}),
		{ kind: "plan", range: future },
	);
});
