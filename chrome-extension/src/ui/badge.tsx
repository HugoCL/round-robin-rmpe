import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"gap-1 rounded-md border px-2 py-0.5 font-medium transition-colors [&>svg]:size-3 inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none overflow-hidden",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground border-transparent",
				secondary: "bg-secondary text-secondary-foreground border-transparent",
				destructive: "bg-destructive/10 text-destructive border-destructive/30",
				outline: "border-border text-foreground",
				ghost: "hover:bg-muted hover:text-muted-foreground border-transparent",
				warning: "bg-warning/20 text-warning border-warning/40",
				success: "bg-success/20 text-success border-success/40",
			},
			size: {
				default: "h-5 text-xs",
				xs: "h-4 text-[10px] px-1.5",
				sm: "h-5 text-xs",
				lg: "h-6 text-sm px-2.5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	size = "default",
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<span
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
