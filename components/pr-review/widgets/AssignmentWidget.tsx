"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { AssignmentCard } from "../AssignmentCard";
import { ForeignTeamAssignmentCard } from "../ForeignTeamAssignmentCard";
import { usePRReview } from "../PRReviewContext";
import {
	useWidgetBox,
	useWidgetSlot,
	WidgetEditHeader,
	widgetEditingClass,
} from "./WidgetFrame";

/**
 * The assignment card in its place among the widgets. It keeps its own
 * surface and has no title at rest; while customizing it takes the dashed box
 * and the arrows, but no remove button and no sizes. Outside a slot (the lanes
 * are stacked) it is pinned and has no controls at all.
 */
export function AssignmentWidget() {
	const slot = useWidgetSlot();
	const { isForeignTeamView } = usePRReview();
	const { movable, dragging, props } = useWidgetBox(slot);
	const headingId = useId();
	const editing = movable && slot !== null;
	// Mounted by a move while customizing, it is already where the eye is.
	const [enters] = useState(!movable);

	return (
		<section
			{...props}
			aria-labelledby={editing ? headingId : undefined}
			className={cn(
				"relative min-w-0",
				enters && "page-enter-soft",
				// The card's corner plus the box's padding, so the two stay concentric.
				editing ? cn(widgetEditingClass, "rounded-[2rem]") : "not-first:mt-6",
				dragging && "opacity-40",
			)}
		>
			{editing ? <WidgetEditHeader slot={slot} headingId={headingId} /> : null}
			<div className={editing ? "mt-2" : undefined} inert={editing}>
				{isForeignTeamView ? <ForeignTeamAssignmentCard /> : <AssignmentCard />}
			</div>
		</section>
	);
}
