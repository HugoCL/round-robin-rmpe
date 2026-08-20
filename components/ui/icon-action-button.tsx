"use client";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Shared geometry for icon bars. Exported for the few triggers that need to be
 * a bare `Button` (e.g. `CollapsibleTrigger asChild`) yet must match the bar.
 */
export const iconActionButtonClass =
	"size-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground";

type IconActionButtonProps = React.ComponentProps<typeof Button> & {
	/** Accessible name, also used as the tooltip text unless `tooltip` is set. */
	label: string;
	tooltip?: string;
	/** Highlights the action with the primary tint. Use for at most one item per bar. */
	accent?: boolean;
};

/**
 * The single shape for icon bars: a 36px circular ghost button with a tooltip.
 * Keeping every header control on this component is what stops the bar from
 * drifting back into a mix of icon-only and labelled buttons.
 */
export function IconActionButton({
	label,
	tooltip,
	accent = false,
	className,
	children,
	...props
}: IconActionButtonProps) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label={label}
						className={cn(
							iconActionButtonClass,
							accent &&
								"bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
							className,
						)}
						{...props}
					>
						{children}
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{tooltip ?? label}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
