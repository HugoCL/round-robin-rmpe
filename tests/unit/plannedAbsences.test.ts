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
	getAbsenceReturnAt,
	getTodayDateKey,
	getWeekdayOfDateKey,
	isValidDateKey,
	parsePlannedAbsenceError,
	plannedAbsenceErrorMessage,
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
