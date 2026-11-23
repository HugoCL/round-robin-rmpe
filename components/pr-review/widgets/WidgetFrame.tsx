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
import { createContext, type ReactNode, useContext, useId } from "react";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { LANE_COUNT, type WidgetId } from "@/lib/widgetLayout";
import { useWidgetLayout } from "./WidgetLayoutContext";

/** Where the layout put the widget being rendered. */
interface WidgetSlot {
	id: WidgetId;
	lane: number;
	index: number;
}

const WidgetSlotContext = createContext<WidgetSlot | null>(null);

export const WidgetSlotProvider = WidgetSlotContext.Provider;

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

function WidgetTools({ slot, title }: { slot: WidgetSlot; title: string }) {
	const t = useTranslations("widgets");
	const { lanes, move, remove } = useWidgetLayout();
	// Below lg the lanes stack into one column, so up and down cross lanes and
	// there is no left or right.
	const stacked = !useMediaQuery("(min-width: 1024px)");
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
		</>
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
	const { editing, draggingId, setDraggingId } = useWidgetLayout();
	const headingId = useId();
	const title = t(`titles.${slot.id}`);

	return (
		<section
			data-widget={slot.id}
			aria-labelledby={headingId}
			draggable={editing || undefined}
			onDragStart={(event) => {
				event.dataTransfer.effectAllowed = "move";
				event.dataTransfer.setData("text/plain", slot.id);
				setDraggingId(slot.id);
			}}
			onDragEnd={() => setDraggingId(null)}
			style={{ viewTransitionName: `widget-${slot.id}` }}
			className={cn(
				"@container relative min-w-0",
				editing
					? "-mx-2 cursor-grab rounded-2xl bg-muted/40 px-2 pt-1.5 pb-3 outline-[1.5px] -outline-offset-1 outline-control-border/70 outline-dashed not-first:mt-3"
					: "not-first:mt-6 not-first:border-t not-first:border-border/70 not-first:pt-5",
				draggingId === slot.id && "opacity-40",
			)}
		>
			<header className="flex min-h-9 items-center gap-2">
				{editing ? (
					<GripVertical
						className="-ml-1 size-4 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
				) : null}
				<h2 id={headingId} className="truncate text-base font-semibold">
					{title}
				</h2>
				{!editing && meta ? (
					<span className="truncate text-xs text-muted-foreground @max-[20rem]:hidden">
						{meta}
					</span>
				) : null}
				<div className="ml-auto flex shrink-0 items-center gap-0.5">
					{editing ? <WidgetTools slot={slot} title={title} /> : actions}
				</div>
			</header>
			<div className="mt-2" inert={editing}>
				{children}
			</div>
		</section>
	);
}
