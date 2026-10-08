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

test("a scheduled plan takes precedence over a manual absence on its days", () => {
	const absentUntil = zonedDateKeyToUtcMs("2026-10-14", TZ);
	const { rows } = build(
		[reviewer("a", { manualIsAbsent: true, absentUntil })],
		[absence("x", "a", "2026-10-08", "2026-10-09")],
	);
	// Wed 7 manual, Thu 8 - Fri 9 planned, Mon 12 - Tue 13 manual.
	assert.deepEqual(
		rows[0].segments.map((s) => [s.kind, s.startIndex, s.endIndex]),
		[
			["now", 0, 0],
			["planned", 1, 2],
			["now", 3, 4],
		],
	);
	assert.equal(rows[0].segments[1].absence?._id, "x");
	assert.equal(rows[0].segments[1].roundStart, true);
	assert.equal(rows[0].segments[1].roundEnd, true);
});

test("an indefinite manual absence still shows a scheduled plan inside the window", () => {
	const { rows } = build(
		[reviewer("a", { manualIsAbsent: true })],
		[absence("x", "a", "2026-10-14", "2026-10-16")],
	);
	const planned = rows[0].segments.find((s) => s.kind === "planned");
	assert.ok(planned);
	assert.equal(planned.absence?._id, "x");
	assert.equal(DAYS[planned.startIndex], "2026-10-14");
	assert.equal(DAYS[planned.endIndex], "2026-10-16");
	assert.equal(rows[0].plannable[planned.startIndex], false);
	// The manual stretch resumes after the plan and still fades at the edge.
	const last = rows[0].segments.at(-1);
	assert.equal(last?.kind, "now");
	assert.equal(last?.absence, null);
	assert.equal(last?.fadeEnd, true);
});

test("an active plan keeps the now colouring and stays editable over a manual absence", () => {
	const { rows } = build(
		[reviewer("a", { manualIsAbsent: true })],
		[absence("x", "a", "2026-10-05", "2026-10-09", "active")],
	);
	const [first] = rows[0].segments;
	assert.equal(first.kind, "now");
	assert.equal(first.absence?._id, "x");
	assert.equal(rows[0].plannable[0], false);
});

test("manual-only cells are plannable; plan cells and past days are not", () => {
	const absentUntil = zonedDateKeyToUtcMs("2026-10-14", TZ);
	const { rows } = build(
		[reviewer("a", { manualIsAbsent: true, absentUntil }), reviewer("b")],
		[absence("x", "a", "2026-10-08", "2026-10-09")],
	);
	// a: Wed manual, Thu-Fri plan, Mon-Tue manual, then free.
	assert.deepEqual(rows[0].plannable.slice(0, 6), [
		true,
		false,
		false,
		true,
		true,
		true,
	]);
	assert.ok(rows[1].plannable.every(Boolean));
});

test("days before today are never plannable", () => {
	const days = buildTimelineDays("2026-10-05", 5); // Mon 5 .. Fri 9
	const { rows } = buildAbsenceTimeline({
		days,
		todayKey: TODAY,
		timeZone: TZ,
		reviewers: [reviewer("a")],
		absences: [],
	});
	assert.deepEqual(rows[0].plannable, [false, false, true, true, true]);
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
