import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A widget's list row: flat at rest, a soft fill on hover. */
export const widgetRowClass =
	"-mx-2 flex min-h-10 items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-muted/40";

/** One muted line for a widget with nothing to show. */
export function WidgetEmpty({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<p className={cn("text-sm text-pretty text-muted-foreground", className)}>
			{children}
		</p>
	);
}
