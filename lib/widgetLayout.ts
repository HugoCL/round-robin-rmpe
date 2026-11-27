/** The assignment card. It moves like a widget but is always in the view. */
export const ASSIGNMENT_ID = "assignment" as const;

export const WIDGET_IDS = [
	ASSIGNMENT_ID,
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

export const WIDGET_SIZES = ["small", "medium", "large"] as const;

export type WidgetSize = (typeof WIDGET_SIZES)[number];

export const DEFAULT_WIDGET_SIZE: WidgetSize = "medium";

/**
 * The sizes each widget has a form for. A lane fixes the width, so a size is
 * how much the widget shows: small is its headline, large adds rows or detail.
 */
export const WIDGET_SIZE_OPTIONS: Record<WidgetId, readonly WidgetSize[]> = {
	assignment: ["medium"],
	history: ["small", "medium", "large"],
	rotation: ["small", "medium"],
	myWeek: ["small", "medium"],
	absences: ["small", "medium", "large"],
	events: ["medium"],
	myReviews: ["small", "medium"],
	teamLoad: ["small", "medium"],
	tags: ["medium"],
	birthdays: ["small", "medium", "large"],
	otherTeams: ["medium"],
};

/**
 * Always exactly LANE_COUNT lanes; a widget appears at most once and the
 * assignment card exactly once. `sizes` holds only the widgets that are not at
 * the default size, and is absent when there are none.
 */
export type WidgetLayout = {
	lanes: WidgetId[][];
	sizes?: Partial<Record<WidgetId, WidgetSize>>;
};

export const DEFAULT_WIDGET_LAYOUT: WidgetLayout = {
	lanes: [
		[ASSIGNMENT_ID, "history"],
		["rotation", "absences"],
		["myWeek", "myReviews", "events"],
	],
};

const KNOWN_IDS: ReadonlySet<string> = new Set(WIDGET_IDS);

function isWidgetId(value: unknown): value is WidgetId {
	return typeof value === "string" && KNOWN_IDS.has(value);
}

function cloneLayout(layout: WidgetLayout): WidgetLayout {
	return withSizes(
		layout.lanes.map((lane) => [...lane]),
		layout.sizes,
	);
}

/** Keeps `sizes` off the layout when it is empty, so equal layouts serialise the same. */
function withSizes(
	lanes: WidgetId[][],
	sizes: WidgetLayout["sizes"],
): WidgetLayout {
	return sizes && Object.keys(sizes).length > 0
		? { lanes, sizes: { ...sizes } }
		: { lanes };
}

function normalizeSizes(raw: unknown): WidgetLayout["sizes"] {
	if (typeof raw !== "object" || raw === null) return undefined;
	const sizes: Partial<Record<WidgetId, WidgetSize>> = {};
	// In WIDGET_IDS order, whatever order the stored keys come in.
	for (const id of WIDGET_IDS) {
		const size = (raw as Record<string, unknown>)[id];
		const supported = WIDGET_SIZE_OPTIONS[id].find((option) => option === size);
		if (supported && supported !== DEFAULT_WIDGET_SIZE) sizes[id] = supported;
	}
	return sizes;
}

/**
 * Boundary parser for stored or client-sent data. Unknown ids and duplicates
 * (first occurrence wins) are dropped, lanes beyond LANE_COUNT merge into the
 * last lane and missing lanes are filled with []. A layout without the
 * assignment card (every layout stored before it could move) gets it back at
 * the top of the first lane. Sizes a widget has no form for are dropped.
 * Anything that is not `{ lanes: unknown[] }` yields the default layout.
 *
 * `stored` is what the person has saved, for a write. A client from before
 * the card could move (a tab left open across the release) sends lanes with
 * no card and no sizes; such a write keeps the card's lane and the sizes from
 * `stored` instead of putting both back to their defaults.
 */
export function normalizeWidgetLayout(
	raw: unknown,
	stored?: unknown,
): WidgetLayout {
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
	if (seen.has(ASSIGNMENT_ID)) {
		return withSizes(lanes, normalizeSizes((raw as { sizes?: unknown }).sizes));
	}
	const previous = stored === undefined ? null : normalizeWidgetLayout(stored);
	const place = previous && findWidget(previous, ASSIGNMENT_ID);
	if (!place) {
		lanes[0].unshift(ASSIGNMENT_ID);
		return withSizes(lanes, normalizeSizes((raw as { sizes?: unknown }).sizes));
	}
	lanes[place.lane].splice(place.index, 0, ASSIGNMENT_ID);
	return withSizes(lanes, previous.sizes);
}

/**
 * What a write stores: nothing for the default view. `null` is how a client
 * from before the card says "my default order", which says nothing about the
 * card or the sizes, so both stay as stored. This client resets by sending
 * the whole default layout.
 */
export function resolveWidgetLayoutWrite(
	sent: unknown,
	stored?: unknown,
): WidgetLayout | undefined {
	const layout = normalizeWidgetLayout(
		sent === null
			? {
					lanes: DEFAULT_WIDGET_LAYOUT.lanes.map((lane) =>
						lane.filter((id) => id !== ASSIGNMENT_ID),
					),
				}
			: sent,
		stored,
	);
	return isDefaultWidgetLayout(layout) ? undefined : layout;
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

	const next = liftWidget(layout, id);
	const laneIndex = Number.isFinite(to.lane)
		? Math.min(Math.max(Math.trunc(to.lane), 0), LANE_COUNT - 1)
		: 0;
	const lane = next.lanes[laneIndex];
	const beforeIndex = to.before === null ? -1 : lane.indexOf(to.before);
	if (beforeIndex === -1) lane.push(id);
	else lane.splice(beforeIndex, 0, id);
	return next;
}

/** Takes `id` out of its lane, keeping its size for the place it lands next. */
function liftWidget(layout: WidgetLayout, id: WidgetId): WidgetLayout {
	return withSizes(
		layout.lanes.map((lane) => lane.filter((w) => w !== id)),
		layout.sizes,
	);
}

/** Removes `id` and forgets its size. The assignment card cannot be removed. */
export function removeWidget(layout: WidgetLayout, id: WidgetId): WidgetLayout {
	if (id === ASSIGNMENT_ID) return layout;
	const { [id]: _removed, ...sizes } = layout.sizes ?? {};
	return liftWidget(withSizes(layout.lanes, sizes), id);
}

export function widgetSize(layout: WidgetLayout, id: WidgetId): WidgetSize {
	return layout.sizes?.[id] ?? DEFAULT_WIDGET_SIZE;
}

/** A size the widget has no form for is a no-op. */
export function setWidgetSize(
	layout: WidgetLayout,
	id: WidgetId,
	size: WidgetSize,
): WidgetLayout {
	if (!WIDGET_SIZE_OPTIONS[id].includes(size)) return layout;
	// Through the parser, so the keys come out in the order the server stores.
	return withSizes(
		layout.lanes,
		normalizeSizes({ ...layout.sizes, [id]: size }),
	);
}

export function isDefaultWidgetLayout(layout: WidgetLayout): boolean {
	return (
		Object.keys(layout.sizes ?? {}).length === 0 &&
		layout.lanes.length === DEFAULT_WIDGET_LAYOUT.lanes.length &&
		layout.lanes.every(
			(lane, i) =>
				lane.length === DEFAULT_WIDGET_LAYOUT.lanes[i].length &&
				lane.every((id, j) => id === DEFAULT_WIDGET_LAYOUT.lanes[i][j]),
		)
	);
}
