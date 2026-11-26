"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { useFeatureEnabled } from "@/components/AppConfigProvider";
import { ToastAction } from "@/components/ui/toast";
import { api } from "@/convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import {
	DEFAULT_WIDGET_LAYOUT,
	findWidget,
	isDefaultWidgetLayout,
	LANE_COUNT,
	moveWidget,
	removeWidget,
	setWidgetSize,
	WIDGET_IDS,
	type WidgetId,
	type WidgetLayout,
	type WidgetSize,
	widgetSize,
} from "@/lib/widgetLayout";
import { usePRReview } from "../PRReviewContext";

type DropTarget = { lane: number; before: WidgetId | null };

interface WidgetLayoutContextValue {
	/**
	 * What each lane shows: the stored layout minus what this team cannot show
	 * and, while it is pinned, minus the assignment card.
	 */
	lanes: WidgetId[][];
	/**
	 * Below lg the lanes stack into one column. The assignment card is then
	 * pinned first, wherever the layout has it: on a phone it is the page.
	 */
	stacked: boolean;
	/**
	 * False against a backend from before sizes and the movable card (a preview
	 * build ahead of it): it could save neither, so neither is on offer and the
	 * card stays pinned.
	 */
	canResize: boolean;
	cardPinned: boolean;
	sizeOf: (id: WidgetId) => WidgetSize;
	/** Widgets this team can show that are not in the view. */
	addable: WidgetId[];
	isShown: (id: WidgetId) => boolean;
	isCustomized: boolean;
	editing: boolean;
	setEditing: (editing: boolean) => void;
	/** Resolves once the DOM shows the new layout, so focus can follow the widget. */
	move: (id: WidgetId, to: DropTarget) => Promise<void>;
	add: (id: WidgetId) => Promise<void>;
	remove: (id: WidgetId) => Promise<void>;
	resize: (id: WidgetId, size: WidgetSize) => void;
	reset: () => void;
	draggingId: WidgetId | null;
	setDraggingId: (id: WidgetId | null) => void;
}

const WidgetLayoutContext = createContext<WidgetLayoutContextValue | undefined>(
	undefined,
);

export function useWidgetLayout() {
	const value = useContext(WidgetLayoutContext);
	if (!value)
		throw new Error("useWidgetLayout must be used within WidgetLayoutProvider");
	return value;
}

/**
 * Runs a layout change as a view transition, so widgets glide to their new
 * place. Resolves once the DOM shows the change, with or without the motion.
 */
function transition(update: () => void): Promise<void> {
	if (
		typeof document.startViewTransition !== "function" ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		flushSync(update);
		return Promise.resolve();
	}
	const viewTransition = document.startViewTransition(() => flushSync(update));
	// A newer edit skips this animation; the layout change itself still lands.
	viewTransition.ready.catch(() => {});
	return viewTransition.updateCallbackDone;
}

// Tailwind's lg, in rem like the classes that stack the lanes.
const LANES_QUERY = "(min-width: 64rem)";

function subscribeToLanes(onChange: () => void) {
	const query = window.matchMedia(LANES_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

export function WidgetLayoutProvider({
	stored,
	onChange,
	children,
}: {
	/** `undefined` until the person customizes their view. */
	stored: WidgetLayout | undefined;
	/** `null` goes back to the default view. */
	onChange: (layout: WidgetLayout | null) => void;
	children: ReactNode;
}) {
	const t = useTranslations("widgets");
	const { hasTags, isForeignTeamView } = usePRReview();
	const eventsEnabled = useFeatureEnabled("events");
	const birthdaysEnabled = useFeatureEnabled("birthdays");
	const crossTeamEnabled = useFeatureEnabled("crossTeamAssignment");
	const canResize =
		useQuery(api.queries.getMyUserPreferences, {})?.widgetSizes === true;
	const [editing, setEditing] = useState(false);
	const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
	const [announcement, setAnnouncement] = useState("");
	// Read during render, not after mount: the card must not start in one
	// place and jump to another.
	const stacked = useSyncExternalStore(
		subscribeToLanes,
		() => !window.matchMedia(LANES_QUERY).matches,
		() => false,
	);
	const cardPinned = stacked || !canResize;

	const layout = stored ?? DEFAULT_WIDGET_LAYOUT;

	// A view transition puts an edit on screen a frame after the click, so a
	// second edit made in between builds on this instead of on its own render.
	const latest = useRef(layout);
	const pendingCommits = useRef(0);
	useEffect(() => {
		if (pendingCommits.current === 0) latest.current = layout;
	}, [layout]);
	// Undo puts back the layout from before the last edit, so it is only on
	// offer while that edit is still the last one.
	const dismissUndo = useRef<(() => void) | null>(null);

	const commit = useCallback(
		(next: WidgetLayout) => {
			latest.current = next;
			dismissUndo.current?.();
			dismissUndo.current = null;
			pendingCommits.current += 1;
			// Arranging the default view by hand is the default view.
			return transition(() =>
				onChange(isDefaultWidgetLayout(next) ? null : next),
			).finally(() => {
				pendingCommits.current -= 1;
			});
		},
		[onChange],
	);
	const offerUndo = useCallback(
		(title: string, previous: WidgetLayout) => {
			dismissUndo.current = toast({
				title,
				action: (
					<ToastAction
						altText={t("undo")}
						onClick={() => void commit(previous)}
					>
						{t("undo")}
					</ToastAction>
				),
			}).dismiss;
		},
		[commit, t],
	);

	// A widget that cannot show here keeps its stored place, so it is back where
	// it was on a team (or after a feature toggle) that can show it.
	const available = useMemo(() => {
		const unavailable: Record<WidgetId, boolean> = {
			assignment: cardPinned,
			history: false,
			rotation: false,
			absences: false,
			teamLoad: false,
			myWeek: isForeignTeamView,
			myReviews: isForeignTeamView,
			tags: !hasTags,
			events: !eventsEnabled,
			birthdays: !birthdaysEnabled,
			otherTeams: !crossTeamEnabled,
		};
		return new Set(WIDGET_IDS.filter((id) => !unavailable[id]));
	}, [
		cardPinned,
		hasTags,
		isForeignTeamView,
		eventsEnabled,
		birthdaysEnabled,
		crossTeamEnabled,
	]);

	const lanes = useMemo(
		() => layout.lanes.map((lane) => lane.filter((id) => available.has(id))),
		[layout, available],
	);
	const addable = useMemo(
		() =>
			WIDGET_IDS.filter((id) => available.has(id) && !findWidget(layout, id)),
		[layout, available],
	);

	const move = useCallback(
		(id: WidgetId, to: DropTarget) => {
			const next = moveWidget(latest.current, id, to);
			const place = findWidget(next, id);
			// The move is silent for a screen reader otherwise: focus stays put.
			if (place)
				setAnnouncement(
					t("moved", {
						name: t(`titles.${id}`),
						lane: place.lane + 1,
						position:
							next.lanes[place.lane]
								.filter((item) => available.has(item))
								.indexOf(id) + 1,
					}),
				);
			return commit(next);
		},
		[commit, available, t],
	);
	const add = useCallback(
		(id: WidgetId) => move(id, { lane: LANE_COUNT - 1, before: null }),
		[move],
	);
	const remove = useCallback(
		(id: WidgetId) => {
			const previous = latest.current;
			const done = commit(removeWidget(previous, id));
			offerUndo(t("removed", { name: t(`titles.${id}`) }), previous);
			return done;
		},
		[commit, offerUndo, t],
	);
	const resize = useCallback(
		(id: WidgetId, size: WidgetSize) => {
			if (widgetSize(latest.current, id) === size) return;
			const next = setWidgetSize(latest.current, id, size);
			if (next === latest.current) return;
			setAnnouncement(
				t("resized", { name: t(`titles.${id}`), size: t(`size.${size}`) }),
			);
			void commit(next);
		},
		[commit, t],
	);
	const reset = useCallback(() => {
		const previous = latest.current;
		void commit(DEFAULT_WIDGET_LAYOUT);
		offerUndo(t("resetDone"), previous);
	}, [commit, offerUndo, t]);

	useEffect(() => {
		if (!editing) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !event.defaultPrevented) setEditing(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [editing]);

	const value = useMemo<WidgetLayoutContextValue>(
		() => ({
			lanes,
			stacked,
			canResize,
			cardPinned,
			sizeOf: (id) => widgetSize(layout, id),
			addable,
			isShown: (id) => lanes.some((lane) => lane.includes(id)),
			isCustomized: stored !== undefined,
			editing,
			setEditing: (next) =>
				void transition(() => {
					setEditing(next);
					if (!next) setDraggingId(null);
				}),
			move,
			add,
			remove,
			resize,
			reset,
			draggingId,
			setDraggingId,
		}),
		[
			lanes,
			stacked,
			canResize,
			cardPinned,
			layout,
			addable,
			stored,
			editing,
			move,
			add,
			remove,
			resize,
			reset,
			draggingId,
		],
	);

	return (
		<WidgetLayoutContext.Provider value={value}>
			{children}
			<p role="status" className="sr-only">
				{editing ? announcement : ""}
			</p>
		</WidgetLayoutContext.Provider>
	);
}
