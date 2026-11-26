"use client";

import { useTranslations } from "next-intl";
import { type DragEvent, Fragment, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ASSIGNMENT_ID, type WidgetId } from "@/lib/widgetLayout";
import { LaunchSpotlight } from "../LaunchSpotlight";
import { usePRReview } from "../PRReviewContext";
import { ReviewersPanel } from "../ReviewersPanel";
import { WIDGETS } from "../widgets/registry";
import { WidgetSlotProvider } from "../widgets/WidgetFrame";
import { useWidgetLayout } from "../widgets/WidgetLayoutContext";
import { ReviewersPanelContext } from "./ReviewersPanelContext";

type DropTarget = { lane: number; before: WidgetId | null };

/** Three lanes from 2xl, two from lg (the third goes under the second), one below. */
const LANE_CLASS = [
	"lg:row-span-2 2xl:row-span-1",
	"",
	"lg:col-start-2 2xl:col-start-3",
];

/** The hairline above a lane wherever it sits under another lane. */
const LANE_DIVIDER = [
	"",
	"max-lg:mt-6 max-lg:border-t max-lg:border-border/70 max-lg:pt-5",
	"max-2xl:mt-6 max-2xl:border-t max-2xl:border-border/70 max-2xl:pt-5",
];

/**
 * The lane that holds the assignment card is the 45rem one, so the card is as
 * wide wherever it goes as it is in the first lane.
 */
const GRID_CLASS = [
	"lg:grid-cols-[minmax(0,45rem)_minmax(20rem,1fr)] 2xl:grid-cols-[45rem_minmax(0,1fr)_minmax(0,1fr)]",
	"lg:grid-cols-[minmax(20rem,1fr)_minmax(0,45rem)] 2xl:grid-cols-[minmax(0,1fr)_45rem_minmax(0,1fr)]",
	"lg:grid-cols-[minmax(20rem,1fr)_minmax(0,45rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_45rem]",
];

/**
 * The launch card floats in the bottom corner the assignment card is not in:
 * the left one when the card is in the last column. With the card in the
 * middle of three lanes neither corner is clear of it, so the launch card
 * stays in the page, under the card.
 */
const SPOTLIGHT_CORNER = [
	"xl:right-4",
	"xl:max-2xl:left-4 2xl:static 2xl:mt-6 2xl:w-auto 2xl:shadow-none",
	"xl:left-4",
];

/**
 * The team page: the assignment card and the person's widgets, in lanes. The
 * card starts at the top of the first lane and moves like a widget; with the
 * lanes stacked it is pinned first.
 */
export function LanesLayout() {
	const t = useTranslations("widgets");
	const { teamSlug } = usePRReview();
	const { lanes, stacked, sizeOf, editing, move, draggingId, setDraggingId } =
		useWidgetLayout();
	const [reviewersOpen, setReviewersOpen] = useState(false);
	const reviewersOpenerRef = useRef<HTMLElement | null>(null);
	const [hovered, setHovered] = useState<DropTarget | null>(null);

	// Stacked, the card is not in `lanes`: it is pinned above them.
	const cardLane = Math.max(
		lanes.findIndex((lane) => lane.includes(ASSIGNMENT_ID)),
		0,
	);
	const target = draggingId ? hovered : null;
	// Dropping a widget where it already is moves nothing, so it shows no marker.
	const isNoOp = (candidate: DropTarget) => {
		if (!draggingId) return true;
		const lane = lanes[candidate.lane];
		const index = lane.indexOf(draggingId);
		return index >= 0 && candidate.before === (lane[index + 1] ?? null);
	};
	const marker = (
		<div aria-hidden="true" className="my-2 h-1 rounded-full bg-primary" />
	);

	const onDragOver = (lane: number) => (event: DragEvent<HTMLDivElement>) => {
		if (!draggingId) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		const next = [
			...event.currentTarget.querySelectorAll<HTMLElement>("[data-widget]"),
		].find((element) => {
			if (element.dataset.widget === draggingId) return false;
			const box = element.getBoundingClientRect();
			return event.clientY < box.top + box.height / 2;
		});
		const before = (next?.dataset.widget as WidgetId | undefined) ?? null;
		setHovered((current) =>
			current?.lane === lane && current.before === before
				? current
				: { lane, before },
		);
	};

	const onDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		if (draggingId && target && !isNoOp(target)) void move(draggingId, target);
		setHovered(null);
		setDraggingId(null);
	};

	return (
		<ReviewersPanelContext.Provider
			value={{
				openPanel: (opener) => {
					reviewersOpenerRef.current = opener;
					setReviewersOpen(true);
				},
			}}
		>
			<div
				// Past the lanes a drop does nothing, so the marker goes too.
				onDragLeave={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null))
						setHovered(null);
				}}
				className={cn(
					"mt-3 grid grid-cols-1 gap-x-7 sm:mt-5 lg:mt-6",
					GRID_CLASS[cardLane],
					// While customizing, every lane reaches the bottom so an empty or
					// short one is still a place to drop.
					editing ? "items-stretch max-lg:pb-40" : "items-start",
				)}
			>
				{lanes.map((ids, lane) => {
					const showMarker =
						target?.lane === lane && !isNoOp(target) ? target : null;
					// Stacked, the card is pinned first. It goes through the same list
					// as in the lanes, so a card at the top of the first lane stays
					// mounted, with what was typed in it, when the window crosses lg.
					const shown: WidgetId[] =
						stacked && lane === 0 ? [ASSIGNMENT_ID, ...ids] : ids;
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: a lane is its position
							key={lane}
							role={editing ? "group" : undefined}
							aria-label={editing ? t("lane", { number: lane + 1 }) : undefined}
							onDragOver={editing ? onDragOver(lane) : undefined}
							onDrop={editing ? onDrop : undefined}
							className={cn(
								"flex min-w-0 flex-col",
								LANE_CLASS[lane],
								(ids.length > 0 || editing) && LANE_DIVIDER[lane],
								editing && "min-h-24",
							)}
						>
							<div className="flex flex-1 flex-col">
								{shown.map((id, position) => {
									const Widget = WIDGETS[id];
									const pinned = stacked && id === ASSIGNMENT_ID;
									return (
										<Fragment key={id}>
											{!pinned && showMarker?.before === id ? marker : null}
											<WidgetSlotProvider
												value={
													pinned
														? null
														: {
																id,
																lane,
																index: ids.indexOf(id),
																size: sizeOf(id),
																afterCard:
																	shown[position - 1] === ASSIGNMENT_ID,
															}
												}
											>
												<Widget />
											</WidgetSlotProvider>
											{/* In the page under the card on a narrow screen, in a corner on a wide one. */}
											{id === ASSIGNMENT_ID ? (
												<LaunchSpotlight className={SPOTLIGHT_CORNER[lane]} />
											) : null}
										</Fragment>
									);
								})}
								{showMarker?.before === null ? marker : null}
							</div>
						</div>
					);
				})}
			</div>
			<ReviewersPanel
				teamSlug={teamSlug}
				open={reviewersOpen}
				onOpenChange={setReviewersOpen}
				returnFocusTo={reviewersOpenerRef}
			/>
		</ReviewersPanelContext.Provider>
	);
}
