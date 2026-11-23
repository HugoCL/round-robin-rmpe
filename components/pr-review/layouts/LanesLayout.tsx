"use client";

import { useTranslations } from "next-intl";
import { type DragEvent, Fragment, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { WidgetId } from "@/lib/widgetLayout";
import { AssignmentCard } from "../AssignmentCard";
import { ForeignTeamAssignmentCard } from "../ForeignTeamAssignmentCard";
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
	"max-2xl:mt-6 max-2xl:border-t max-2xl:border-border/70 max-2xl:pt-5 lg:col-start-2 2xl:col-start-3",
];

/**
 * The team page: the assignment card pinned at the top of the first lane and
 * the person's widgets in lanes around it.
 */
export function LanesLayout() {
	const t = useTranslations("widgets");
	const { teamSlug, isForeignTeamView } = usePRReview();
	const { lanes, editing, move, draggingId, setDraggingId } = useWidgetLayout();
	const [reviewersOpen, setReviewersOpen] = useState(false);
	const reviewersOpenerRef = useRef<HTMLElement | null>(null);
	const [hovered, setHovered] = useState<DropTarget | null>(null);

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
					"mt-3 grid grid-cols-1 gap-x-7 sm:mt-5 lg:mt-6 lg:grid-cols-[minmax(0,45rem)_minmax(20rem,1fr)] 2xl:grid-cols-[45rem_minmax(0,1fr)_minmax(0,1fr)]",
					// While customizing, every lane reaches the bottom so an empty or
					// short one is still a place to drop.
					editing ? "items-stretch max-lg:pb-40" : "items-start",
				)}
			>
				{lanes.map((ids, lane) => {
					const showMarker =
						target?.lane === lane && !isNoOp(target) ? target : null;
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
								editing && "min-h-24",
							)}
						>
							{lane === 0 ? (
								<section className="page-enter-soft mb-6">
									{isForeignTeamView ? (
										<ForeignTeamAssignmentCard />
									) : (
										<AssignmentCard />
									)}
								</section>
							) : null}
							{/* In the page here on a narrow screen, in a corner on a wide one. */}
							{lane === 0 ? <LaunchSpotlight /> : null}
							<div className="flex flex-1 flex-col">
								{ids.map((id, index) => {
									const Widget = WIDGETS[id];
									return (
										<Fragment key={id}>
											{showMarker?.before === id ? marker : null}
											<WidgetSlotProvider value={{ id, lane, index }}>
												<Widget />
											</WidgetSlotProvider>
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
