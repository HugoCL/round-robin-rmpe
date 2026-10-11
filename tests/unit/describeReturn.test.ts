import assert from "node:assert/strict";
import test from "node:test";
import type { useTranslations } from "next-intl";
import { describeReturn } from "../../components/pr-review/describeReturn";
import { zonedDateKeyToUtcMs } from "../../lib/plannedAbsences";

const t = ((key: string, values?: { when?: string; date?: string }) =>
	`${key}:${values?.when ?? values?.date}`) as unknown as ReturnType<
	typeof useTranslations
>;
const SANTIAGO = "America/Santiago";
const at = (dateKey: string, hour = 0) =>
	zonedDateKeyToUtcMs(dateKey, SANTIAGO) + hour * 3_600_000;
const now = at("2026-10-11", 22);

test("says how many days are left within a week", () => {
	assert.equal(
		describeReturn(t, "es", SANTIAGO, at("2026-10-11", 23), now),
		"partTime.returningRelative:hoy",
	);
	assert.equal(
		describeReturn(t, "es", SANTIAGO, at("2026-10-12"), now),
		"partTime.returningRelative:mañana",
	);
	assert.equal(
		describeReturn(t, "es", SANTIAGO, at("2026-10-18"), now),
		"partTime.returningRelative:dentro de 7 días",
	);
});

test("shows the date after a week, with the year only when it changes", () => {
	assert.equal(
		describeReturn(t, "es", SANTIAGO, at("2026-10-19"), now),
		"partTime.returningOn:lun, 19 oct",
	);
	assert.equal(
		describeReturn(t, "en", SANTIAGO, at("2027-01-04"), now),
		"partTime.returningOn:Mon, Jan 4, 2027",
	);
});

test("counts calendar days in the team's time zone", () => {
	// 22:00 in Santiago is already the 12th in UTC; the return on the 13th is still two days away.
	assert.equal(
		describeReturn(t, "es", SANTIAGO, at("2026-10-13"), now),
		"partTime.returningRelative:pasado mañana",
	);
});
