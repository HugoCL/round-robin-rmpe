import assert from "node:assert/strict";
import test from "node:test";
import {
	buildAbsenceTimeline,
	type TimelineAbsenceInput,
	type TimelineReviewerInput,
} from "../../lib/absenceTimeline";
import {
	buildTimelineDays,
	zonedDateKeyToUtcMs,
} from "../../lib/plannedAbsences";

const TZ = "America/Mexico_City";
// Wednesday 2026-10-07; window runs Wed 7 Oct to Tue 27 Oct (15 weekdays).
const TODAY = "2026-10-07";
const DAYS = buildTimelineDays(TODAY, 15);

function reviewer(
	id: string,
	extra: Partial<TimelineReviewerInput> = {},
): TimelineReviewerInput {
	return { _id: id, manualIsAbsent: false, ...extra };
}

function absence(
	id: string,
	reviewerId: string,
	startDate: string,
	endDate: string,
	status: TimelineAbsenceInput["status"] = "scheduled",
): TimelineAbsenceInput {
	return { _id: id, reviewerId, startDate, endDate, status };
}

function build(
	reviewers: TimelineReviewerInput[],
	absences: TimelineAbsenceInput[] = [],
) {
	return buildAbsenceTimeline({
		days: DAYS,
		todayKey: TODAY,
		timeZone: TZ,
		reviewers,
		absences,
	});
}

test("a planned bar spans a weekend as one segment with rounded ends", () => {
	// Thu 8 Oct .. Tue 13 Oct crosses Sat/Sun.
	const { rows } = build(
		[reviewer("a")],
		[absence("x", "a", "2026-10-08", "2026-10-13")],
	);
	assert.equal(rows[0].segments.length, 1);
	const [segment] = rows[0].segments;
	assert.equal(segment.kind, "planned");
	assert.deepEqual([segment.startIndex, segment.endIndex], [1, 4]);
	assert.equal(segment.roundStart, true);
	assert.equal(segment.roundEnd, true);
});

test("bars that run past the window edge stay square there", () => {
	const { rows } = build(
		[reviewer("a")],
		[absence("x", "a", "2026-10-22", "2026-11-06")],
	);
	const [segment] = rows[0].segments;
	assert.equal(segment.endIndex, DAYS.length - 1);
	assert.equal(segment.roundStart, true);
	assert.equal(segment.roundEnd, false);
});

test("a bar that began before the first column is square at the start", () => {
	const { rows } = build(
		[reviewer("a")],
		[absence("x", "a", "2026-10-01", "2026-10-09", "active")],
	);
	const [segment] = rows[0].segments;
	assert.equal(segment.kind, "now");
	assert.equal(segment.startIndex, 0);
	assert.equal(segment.roundStart, false);
	assert.equal(segment.roundEnd, true);
});

test("a Friday-ending bar followed by a Monday one is two rounded bars", () => {
	const { rows } = build(
		[reviewer("a")],
		[
			absence("x", "a", "2026-10-09", "2026-10-09"),
			absence("y", "a", "2026-10-12", "2026-10-12"),
		],
	);
	assert.equal(rows[0].segments.length, 2);
	for (const segment of rows[0].segments) {
		assert.equal(segment.roundStart, true);
		assert.equal(segment.roundEnd, true);
	}
});

test("a manual absence ends the day before the team-local return date", () => {
	// Back at 00:00 on Mon 12 Oct, Mexico City time: last away day is Fri 9 Oct.
	const absentUntil = zonedDateKeyToUtcMs("2026-10-12", TZ);
	const { rows } = build([
		reviewer("a", { manualIsAbsent: true, absentUntil }),
	]);
	const [segment] = rows[0].segments;
	assert.equal(segment.kind, "now");
	assert.equal(DAYS[segment.endIndex], "2026-10-09");
	assert.equal(segment.endDate, "2026-10-11"); // weekend days are not columns
	assert.equal(segment.fadeEnd, false);
	assert.equal(segment.roundStart, true);
	assert.equal(segment.roundEnd, true);
});

test("a manual absence returning mid-day still covers that day", () => {
	const absentUntil = zonedDateKeyToUtcMs("2026-10-12", TZ) + 15 * 3_600_000;
	const { rows } = build([
		reviewer("a", { manualIsAbsent: true, absentUntil }),
	]);
	assert.equal(DAYS[rows[0].segments[0].endIndex], "2026-10-12");
});

test("a manual absence without a return date runs to the window end and fades", () => {
	const { rows } = build([reviewer("a", { manualIsAbsent: true })]);
	const [segment] = rows[0].segments;
	assert.equal(segment.startIndex, 0);
	assert.equal(segment.endIndex, DAYS.length - 1);
	assert.equal(segment.endDate, null);
	assert.equal(segment.fadeEnd, true);
	assert.equal(segment.roundEnd, false);
});

test("now wins over a scheduled absence on the same days", () => {
	const absentUntil = zonedDateKeyToUtcMs("2026-10-12", TZ);
	const { rows } = build(
		[reviewer("a", { manualIsAbsent: true, absentUntil })],
		[absence("x", "a", "2026-10-08", "2026-10-09")],
	);
	assert.equal(rows[0].segments.length, 1);
	assert.equal(rows[0].segments[0].kind, "now");
});

test("completed and cancelled absences are not drawn", () => {
	const { rows } = build(
		[reviewer("a")],
		[
			absence("x", "a", "2026-10-08", "2026-10-09", "completed"),
			absence("y", "a", "2026-10-12", "2026-10-13", "cancelled"),
		],
	);
	assert.equal(rows[0].segments.length, 0);
});

test("part-time off days are marked only when no bar covers them", () => {
	const { rows } = build(
		[
			reviewer("a", {
				partTimeSchedule: { workingDays: ["monday", "tuesday", "wednesday"] },
			}),
		],
		[absence("x", "a", "2026-10-08", "2026-10-08")],
	);
	// Wed 7 works, Thu 8 is covered by a bar, Fri 9 is off.
	assert.deepEqual(rows[0].partTimeOff.slice(0, 4), [
		false,
		false,
		true,
		false,
	]);
});

test("availability counts only in-pool reviewers without a bar or day off", () => {
	const { available, poolSize, lowThreshold, rows } = build(
		[
			reviewer("a"),
			reviewer("b"),
			reviewer("c", { partTimeSchedule: { workingDays: ["wednesday"] } }),
			reviewer("out", { excludedFromReviewPool: true }),
		],
		[absence("x", "a", "2026-10-08", "2026-10-08")],
	);
	assert.equal(poolSize, 3);
	assert.equal(lowThreshold, 1);
	assert.equal(rows[3].inPool, false);
	// Wed: a, b, c work. Thu: a away, c off -> only b.
	assert.deepEqual(available.slice(0, 2), [3, 1]);
});
