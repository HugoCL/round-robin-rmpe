"use client";

import {
	createContext,
	useContext,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";
import {
	useWidgetBox,
	useWidgetSlot,
	WidgetEditHeader,
	widgetEditingClass,
} from "./WidgetFrame";

/**
 * The element the card is rendered into, once, above the lanes. Each place
 * the card can be adopts it, so the form and what was typed in it survive a
 * move to another lane and the window crossing lg.
 */
export const AssignmentCardHost = createContext<HTMLElement | null>(null);

/**
 * The assignment card in its place among the widgets. It keeps its own
 * surface and has no title at rest; while customizing it takes the dashed box
 * and the arrows, but no remove button and no sizes. Outside a slot (the lanes
 * are stacked) it is pinned and has no controls at all.
 */
export function AssignmentWidget() {
	const slot = useWidgetSlot();
	const { movable, dragging, props } = useWidgetBox(slot);
	const headingId = useId();
	const editing = movable && slot !== null;
	// Mounted by a move while customizing, it is already where the eye is.
	const [enters] = useState(!movable);
	const host = useContext(AssignmentCardHost);
	const place = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		if (host) place.current?.appendChild(host);
	}, [host]);

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
			<div
				ref={place}
				className={editing ? "mt-2" : undefined}
				inert={editing}
			/>
		</section>
	);
}
