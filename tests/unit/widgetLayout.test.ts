import assert from "node:assert/strict";
import test from "node:test";
import {
	DEFAULT_WIDGET_LAYOUT,
	findWidget,
	isDefaultWidgetLayout,
	LANE_COUNT,
	moveWidget,
	normalizeWidgetLayout,
	placedWidgets,
	removeWidget,
	type WidgetLayout,
} from "../../lib/widgetLayout";

const layout: WidgetLayout = {
	lanes: [["history", "tags"], ["rotation", "absences", "events"], ["myWeek"]],
};

test("normalize falls back to the default for anything that is not a layout", () => {
	for (const raw of [
		null,
		undefined,
		42,
		"lanes",
		[],
		{},
		{ lanes: "history" },
		{ lanes: { 0: ["history"] } },
	]) {
		assert.deepEqual(normalizeWidgetLayout(raw), DEFAULT_WIDGET_LAYOUT);
	}
});

test("normalize returns a copy, not the shared default", () => {
	const result = normalizeWidgetLayout(null);
	result.lanes[0].push("tags");
	assert.deepEqual(DEFAULT_WIDGET_LAYOUT.lanes[0], ["history"]);
});

test("normalize drops unknown ids and non-string entries", () => {
	const result = normalizeWidgetLayout({
		lanes: [["history", "removedInLaterRelease", 7, null], ["rotation"], []],
	});
	assert.deepEqual(result.lanes, [["history"], ["rotation"], []]);
});

test("normalize keeps the first occurrence of a duplicated widget", () => {
	const result = normalizeWidgetLayout({
		lanes: [["history", "tags"], ["tags", "rotation", "history"], ["rotation"]],
	});
	assert.deepEqual(result.lanes, [["history", "tags"], ["rotation"], []]);
});

test("normalize merges lanes beyond the lane count into the last lane", () => {
	const result = normalizeWidgetLayout({
		lanes: [
			["history"],
			["rotation"],
			["myWeek"],
			["tags"],
			["events", "tags"],
		],
	});
	assert.equal(result.lanes.length, LANE_COUNT);
	assert.deepEqual(result.lanes, [
		["history"],
		["rotation"],
		["myWeek", "tags", "events"],
	]);
});

test("normalize fills missing lanes with empty ones", () => {
	assert.deepEqual(normalizeWidgetLayout({ lanes: [["tags"]] }).lanes, [
		["tags"],
		[],
		[],
	]);
	assert.deepEqual(normalizeWidgetLayout({ lanes: [] }).lanes, [[], [], []]);
});

test("normalize treats a malformed lane as empty", () => {
	const result = normalizeWidgetLayout({ lanes: ["history", ["tags"], null] });
	assert.deepEqual(result.lanes, [[], ["tags"], []]);
});

test("normalize leaves a valid layout unchanged", () => {
	assert.deepEqual(normalizeWidgetLayout(layout), layout);
	assert.deepEqual(
		normalizeWidgetLayout(normalizeWidgetLayout(layout)),
		layout,
	);
	assert.deepEqual(
		normalizeWidgetLayout(DEFAULT_WIDGET_LAYOUT),
		DEFAULT_WIDGET_LAYOUT,
	);
});

test("findWidget locates a placed widget and returns null for an absent one", () => {
	assert.deepEqual(findWidget(layout, "events"), { lane: 1, index: 2 });
	assert.deepEqual(findWidget(layout, "history"), { lane: 0, index: 0 });
	assert.equal(findWidget(layout, "birthdays"), null);
});

test("placedWidgets lists every widget once, lane by lane", () => {
	assert.deepEqual(placedWidgets(layout), [
		"history",
		"tags",
		"rotation",
		"absences",
		"events",
		"myWeek",
	]);
});

test("moves a widget up within its lane", () => {
	const result = moveWidget(layout, "events", { lane: 1, before: "rotation" });
	assert.deepEqual(result.lanes[1], ["events", "rotation", "absences"]);
});

test("moves a widget down within its lane", () => {
	const result = moveWidget(layout, "rotation", { lane: 1, before: "events" });
	assert.deepEqual(result.lanes[1], ["absences", "rotation", "events"]);
});

test("moves a widget across lanes, before a neighbour", () => {
	const result = moveWidget(layout, "absences", { lane: 0, before: "tags" });
	assert.deepEqual(result.lanes, [
		["history", "absences", "tags"],
		["rotation", "events"],
		["myWeek"],
	]);
});

test("moves a widget to the end of a lane with before: null", () => {
	const result = moveWidget(layout, "history", { lane: 2, before: null });
	assert.deepEqual(result.lanes, [
		["tags"],
		["rotation", "absences", "events"],
		["myWeek", "history"],
	]);
});

test("moves to the end of the same lane with before: null", () => {
	const result = moveWidget(layout, "history", { lane: 0, before: null });
	assert.deepEqual(result.lanes[0], ["tags", "history"]);
});

test("moves into an empty lane", () => {
	const result = moveWidget({ lanes: [["history"], [], []] }, "history", {
		lane: 2,
		before: null,
	});
	assert.deepEqual(result.lanes, [[], [], ["history"]]);
});

test("appends when before is not in the target lane", () => {
	const result = moveWidget(layout, "history", { lane: 2, before: "tags" });
	assert.deepEqual(result.lanes[2], ["myWeek", "history"]);
});

test("adds an absent widget at the requested position", () => {
	const result = moveWidget(layout, "birthdays", { lane: 2, before: "myWeek" });
	assert.deepEqual(result.lanes[2], ["birthdays", "myWeek"]);
	assert.equal(
		placedWidgets(result).filter((id) => id === "birthdays").length,
		1,
	);
	const appended = moveWidget(layout, "birthdays", { lane: 0, before: null });
	assert.deepEqual(appended.lanes[0], ["history", "tags", "birthdays"]);
});

test("moving a widget before itself changes nothing", () => {
	const result = moveWidget(layout, "tags", { lane: 2, before: "tags" });
	assert.deepEqual(result, layout);
});

test("clamps the lane into range", () => {
	assert.deepEqual(
		moveWidget(layout, "tags", { lane: 99, before: null }).lanes[2],
		["myWeek", "tags"],
	);
	assert.deepEqual(
		moveWidget(layout, "tags", { lane: -4, before: null }).lanes[0],
		["history", "tags"],
	);
	assert.equal(
		moveWidget(layout, "tags", { lane: -1, before: null }).lanes.length,
		LANE_COUNT,
	);
});

test("a move never duplicates or loses other widgets", () => {
	const before = placedWidgets(layout).sort();
	const after = placedWidgets(
		moveWidget(layout, "rotation", { lane: 2, before: "myWeek" }),
	).sort();
	assert.deepEqual(after, before);
});

test("move and remove do not mutate their input", () => {
	const snapshot = structuredClone(layout);
	moveWidget(layout, "history", { lane: 2, before: "myWeek" });
	moveWidget(layout, "birthdays", { lane: 0, before: null });
	removeWidget(layout, "rotation");
	assert.deepEqual(layout, snapshot);
});

test("removes a placed widget and ignores an absent one", () => {
	const result = removeWidget(layout, "absences");
	assert.deepEqual(result.lanes, [
		["history", "tags"],
		["rotation", "events"],
		["myWeek"],
	]);
	assert.deepEqual(removeWidget(layout, "birthdays"), layout);
});

test("isDefaultWidgetLayout recognises the default and only the default", () => {
	assert.equal(isDefaultWidgetLayout(DEFAULT_WIDGET_LAYOUT), true);
	assert.equal(isDefaultWidgetLayout(normalizeWidgetLayout(null)), true);
	assert.equal(isDefaultWidgetLayout(layout), false);
	assert.equal(
		isDefaultWidgetLayout(removeWidget(DEFAULT_WIDGET_LAYOUT, "events")),
		false,
	);
	assert.equal(
		isDefaultWidgetLayout(
			moveWidget(DEFAULT_WIDGET_LAYOUT, "absences", {
				lane: 1,
				before: "rotation",
			}),
		),
		false,
	);
});
