export const WIDGET_IDS = [
	"history",
	"rotation",
	"myWeek",
	"absences",
	"events",
	"myReviews",
	"teamLoad",
	"tags",
	"birthdays",
	"otherTeams",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export const LANE_COUNT = 3;

/** Always exactly LANE_COUNT lanes; a widget appears at most once. */
export type WidgetLayout = { lanes: WidgetId[][] };

export const DEFAULT_WIDGET_LAYOUT: WidgetLayout = {
	lanes: [
		["history"],
		["rotation", "absences"],
		["myWeek", "myReviews", "events"],
	],
};

const KNOWN_IDS: ReadonlySet<string> = new Set(WIDGET_IDS);

function isWidgetId(value: unknown): value is WidgetId {
	return typeof value === "string" && KNOWN_IDS.has(value);
}

function cloneLayout(layout: WidgetLayout): WidgetLayout {
	return { lanes: layout.lanes.map((lane) => [...lane]) };
}

/**
 * Boundary parser for stored or client-sent data. Unknown ids and duplicates
 * (first occurrence wins) are dropped, lanes beyond LANE_COUNT merge into the
 * last lane and missing lanes are filled with []. Anything that is not
 * `{ lanes: unknown[] }` yields the default layout.
 */
export function normalizeWidgetLayout(raw: unknown): WidgetLayout {
	const rawLanes =
		typeof raw === "object" && raw !== null
			? (raw as { lanes?: unknown }).lanes
			: undefined;
	if (!Array.isArray(rawLanes)) return cloneLayout(DEFAULT_WIDGET_LAYOUT);

	const seen = new Set<WidgetId>();
	const lanes: WidgetId[][] = Array.from({ length: LANE_COUNT }, () => []);
	rawLanes.forEach((rawLane, laneIndex) => {
		if (!Array.isArray(rawLane)) return;
		const lane = lanes[Math.min(laneIndex, LANE_COUNT - 1)];
		for (const id of rawLane) {
			if (!isWidgetId(id) || seen.has(id)) continue;
			seen.add(id);
			lane.push(id);
		}
	});
	return { lanes };
}

export function findWidget(
	layout: WidgetLayout,
	id: WidgetId,
): { lane: number; index: number } | null {
	for (let lane = 0; lane < layout.lanes.length; lane++) {
		const index = layout.lanes[lane].indexOf(id);
		if (index !== -1) return { lane, index };
	}
	return null;
}

export function placedWidgets(layout: WidgetLayout): WidgetId[] {
	return layout.lanes.flat();
}

/**
 * Moves `id` (or adds it if absent) into `to.lane`, right before `to.before`,
 * or at the end of the lane when `before` is null or not in that lane.
 * `before === id` is a no-op.
 */
export function moveWidget(
	layout: WidgetLayout,
	id: WidgetId,
	to: { lane: number; before: WidgetId | null },
): WidgetLayout {
	if (to.before === id) return layout;

	const next = removeWidget(layout, id);
	const laneIndex = Number.isFinite(to.lane)
		? Math.min(Math.max(Math.trunc(to.lane), 0), LANE_COUNT - 1)
		: 0;
	const lane = next.lanes[laneIndex];
	const beforeIndex = to.before === null ? -1 : lane.indexOf(to.before);
	if (beforeIndex === -1) lane.push(id);
	else lane.splice(beforeIndex, 0, id);
	return next;
}

export function removeWidget(layout: WidgetLayout, id: WidgetId): WidgetLayout {
	return { lanes: layout.lanes.map((lane) => lane.filter((w) => w !== id)) };
}

export function isDefaultWidgetLayout(layout: WidgetLayout): boolean {
	return (
		layout.lanes.length === DEFAULT_WIDGET_LAYOUT.lanes.length &&
		layout.lanes.every(
			(lane, i) =>
				lane.length === DEFAULT_WIDGET_LAYOUT.lanes[i].length &&
				lane.every((id, j) => id === DEFAULT_WIDGET_LAYOUT.lanes[i][j]),
		)
	);
}
