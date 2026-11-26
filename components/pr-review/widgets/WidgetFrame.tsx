"use client";

import {
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	GripVertical,
	X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
	createContext,
	type DragEvent,
	type ReactNode,
	useContext,
	useId,
} from "react";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { cn } from "@/lib/utils";
import {
	ASSIGNMENT_ID,
	DEFAULT_WIDGET_SIZE,
	LANE_COUNT,
	WIDGET_SIZE_OPTIONS,
	type WidgetId,
	type WidgetSize,
} from "@/lib/widgetLayout";
import { useWidgetLayout } from "./WidgetLayoutContext";

/** Where the layout put the widget being rendered. */
export interface WidgetSlot {
	id: WidgetId;
	lane: number;
	index: number;
	size: WidgetSize;
	/** Right under the assignment card, whose own edge already separates them. */
	afterCard: boolean;
}

const WidgetSlotContext = createContext<WidgetSlot | null>(null);

export const WidgetSlotProvider = WidgetSlotContext.Provider;

/** The slot of the widget being rendered, or null outside the lanes. */
export const useWidgetSlot = () => useContext(WidgetSlotContext);

/** The size the person picked for the widget being rendered. */
export function useWidgetSize(): WidgetSize {
	return useContext(WidgetSlotContext)?.size ?? DEFAULT_WIDGET_SIZE;
}

type Tool = "left" | "up" | "down" | "right" | "remove";

/**
 * Puts the keyboard on a widget's controls. After a move the widget may have
 * been re-mounted in another lane, and after an add or a remove the button
 * that was pressed is gone.
 */
export function focusTool(id: WidgetId, tool: Tool) {
	const widget = document.querySelector(`[data-widget="${id}"]`);
	const same = widget?.querySelector<HTMLButtonElement>(
		`[data-tool="${tool}"]`,
	);
	const target =
		same && !same.disabled
			? same
			: widget?.querySelector<HTMLButtonElement>("[data-tool]:not(:disabled)");
	target?.focus();
}

/** With no widget left to land on, the keyboard goes to "Done". */
function focusDone() {
	document.querySelector<HTMLElement>("[data-widget-done]")?.focus();
}

// The scroll margins keep a control that takes focus after a move clear of the
// sticky header on desktop and of the bar fixed to the bottom on phones.
/**
 * A click made with Enter or Space. Only then does focus follow the widget:
 * moving it for someone using the pointer opens a tooltip they did not ask for.
 */
export const isKeyboardClick = (event: { detail: number }) =>
	event.detail === 0;

const toolClass =
	"relative size-8 scroll-mt-44 scroll-mb-44 after:absolute after:-inset-y-1 after:inset-x-0 disabled:opacity-30 max-lg:size-10";

export function WidgetTools({
	slot,
	title,
}: {
	slot: WidgetSlot;
	title: string;
}) {
	const t = useTranslations("widgets");
	// Stacked, up and down cross lanes and there is no left or right.
	const { lanes, stacked, move, remove } = useWidgetLayout();
	const lane = lanes[slot.lane];
	const previousLane = slot.lane > 0 ? slot.lane - 1 : null;
	const nextLane = slot.lane < LANE_COUNT - 1 ? slot.lane + 1 : null;

	const go = (
		event: { detail: number },
		tool: Tool,
		to: { lane: number; before: WidgetId | null },
	) => {
		const follow = isKeyboardClick(event);
		void move(slot.id, to).then(() => follow && focusTool(slot.id, tool));
	};

	const up =
		slot.index > 0
			? { lane: slot.lane, before: lane[slot.index - 1] }
			: stacked && previousLane !== null
				? { lane: previousLane, before: null }
				: null;
	const down =
		slot.index < lane.length - 1
			? { lane: slot.lane, before: lane[slot.index + 2] ?? null }
			: stacked && nextLane !== null
				? { lane: nextLane, before: lanes[nextLane][0] ?? null }
				: null;

	return (
		<>
			{stacked ? null : (
				<IconActionButton
					data-tool="left"
					label={t("moveToPreviousLane", { name: title })}
					className={toolClass}
					disabled={previousLane === null}
					onClick={(event) =>
						previousLane !== null &&
						go(event, "left", { lane: previousLane, before: null })
					}
				>
					<ArrowLeft />
				</IconActionButton>
			)}
			<IconActionButton
				data-tool="up"
				label={t("moveUp", { name: title })}
				className={toolClass}
				disabled={!up}
				onClick={(event) => up && go(event, "up", up)}
			>
				<ArrowUp />
			</IconActionButton>
			<IconActionButton
				data-tool="down"
				label={t("moveDown", { name: title })}
				className={toolClass}
				disabled={!down}
				onClick={(event) => down && go(event, "down", down)}
			>
				<ArrowDown />
			</IconActionButton>
			{stacked ? null : (
				<IconActionButton
					data-tool="right"
					label={t("moveToNextLane", { name: title })}
					className={toolClass}
					disabled={nextLane === null}
					onClick={(event) =>
						nextLane !== null &&
						go(event, "right", { lane: nextLane, before: null })
					}
				>
					<ArrowRight />
				</IconActionButton>
			)}
			{slot.id === ASSIGNMENT_ID ? null : (
				<IconActionButton
					data-tool="remove"
					label={t("remove", { name: title })}
					className={toolClass}
					onClick={(event) => {
						const follow = isKeyboardClick(event);
						const neighbour =
							lane[slot.index + 1] ??
							lane[slot.index - 1] ??
							lanes.flat().find((id) => id !== slot.id);
						void remove(slot.id).then(() => {
							if (!follow) return;
							if (neighbour) focusTool(neighbour, "remove");
							else focusDone();
						});
					}}
				>
					<X />
				</IconActionButton>
			)}
		</>
	);
}

/** The sizes the widget has a form for, as one segmented choice. */
function WidgetSizeControl({
	slot,
	title,
}: {
	slot: WidgetSlot;
	title: string;
}) {
	const t = useTranslations("widgets");
	const { resize, canResize } = useWidgetLayout();
	const options = WIDGET_SIZE_OPTIONS[slot.id];
	if (!canResize || options.length < 2) return null;

	return (
		<div
			role="group"
			aria-label={t("size.group", { name: title })}
			className="mt-2 flex w-fit rounded-full bg-background p-0.5 outline-1 -outline-offset-1 outline-border"
		>
			{options.map((size) => (
				<button
					key={size}
					type="button"
					aria-pressed={slot.size === size}
					onClick={() => resize(slot.id, size)}
					className={cn(
						"relative h-8 rounded-full px-3 text-xs font-medium transition-[background-color,color,scale] duration-150 after:absolute after:-inset-y-1 after:inset-x-0 active:scale-[0.96] max-lg:h-9 max-lg:px-3.5",
						slot.size === size
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{t(`size.${size}`)}
				</button>
			))}
		</div>
	);
}

/** While customizing, a widget is a dashed box that can be dragged. */
export const widgetEditingClass =
	"-mx-2 cursor-grab rounded-2xl bg-muted/40 px-2 pt-1.5 pb-3 outline-[1.5px] -outline-offset-1 outline-control-border/70 outline-dashed not-first:mt-3";

/** What makes a slot's element the thing that is dragged, found and animated. */
export function useWidgetBox(slot: WidgetSlot | null) {
	const { editing, draggingId, setDraggingId } = useWidgetLayout();
	if (!slot) return { movable: false, dragging: false, props: {} };
	return {
		movable: editing,
		dragging: draggingId === slot.id,
		props: {
			"data-widget": slot.id,
			draggable: editing || undefined,
			onDragStart: (event: DragEvent<HTMLElement>) => {
				event.dataTransfer.effectAllowed = "move";
				event.dataTransfer.setData("text/plain", slot.id);
				setDraggingId(slot.id);
			},
			onDragEnd: () => setDraggingId(null),
			style: { viewTransitionName: `widget-${slot.id}` },
		},
	};
}

/** The title row of a widget while customizing: grip, name and move controls. */
export function WidgetEditHeader({
	slot,
	headingId,
}: {
	slot: WidgetSlot;
	headingId: string;
}) {
	const t = useTranslations("widgets");
	const title = t(`titles.${slot.id}`);
	return (
		<header className="flex min-h-9 items-center gap-2">
			<GripVertical
				className="-ml-1 size-4 shrink-0 text-muted-foreground"
				aria-hidden="true"
			/>
			<h2 id={headingId} className="truncate text-base font-semibold">
				{title}
			</h2>
			<div className="ml-auto flex shrink-0 items-center gap-0.5">
				<WidgetTools slot={slot} title={title} />
			</div>
		</header>
	);
}

/**
 * The shell every widget shares: a title row and the content under it. No card
 * at rest; while customizing it becomes a dashed box with the move controls.
 */
export function WidgetFrame({
	meta,
	actions,
	children,
}: {
	/** A short fact next to the title, e.g. "6 de 8 disponibles". */
	meta?: ReactNode;
	/** The widget's own controls; hidden while customizing. */
	actions?: ReactNode;
	children: ReactNode;
}) {
	const slot = useContext(WidgetSlotContext);
	if (!slot) throw new Error("WidgetFrame must render inside a widget slot");
	const t = useTranslations("widgets");
	const { movable: editing, dragging, props } = useWidgetBox(slot);
	const headingId = useId();
	const title = t(`titles.${slot.id}`);

	return (
		<section
			{...props}
			aria-labelledby={headingId}
			className={cn(
				"@container relative min-w-0",
				editing
					? widgetEditingClass
					: slot.afterCard
						? "mt-6"
						: "not-first:mt-6 not-first:border-t not-first:border-border/70 not-first:pt-5",
				dragging && "opacity-40",
			)}
		>
			{editing ? (
				<>
					<WidgetEditHeader slot={slot} headingId={headingId} />
					<WidgetSizeControl slot={slot} title={title} />
				</>
			) : (
				<header className="flex min-h-9 items-center gap-2">
					<h2 id={headingId} className="truncate text-base font-semibold">
						{title}
					</h2>
					{meta ? (
						<span className="truncate text-xs text-muted-foreground @max-[20rem]:hidden">
							{meta}
						</span>
					) : null}
					<div className="ml-auto flex shrink-0 items-center gap-0.5">
						{actions}
					</div>
				</header>
			)}
			<div className="mt-2" inert={editing}>
				{children}
			</div>
		</section>
	);
}
