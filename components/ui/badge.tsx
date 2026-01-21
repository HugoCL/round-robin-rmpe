import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"gap-1 rounded-md border px-2 py-0.5 font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-colors overflow-hidden group/badge",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground border-transparent [a]:hover:bg-primary/80",
				secondary:
					"bg-secondary text-secondary-foreground border-transparent [a]:hover:bg-secondary/80",
				destructive:
					"bg-destructive/10 [a]:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-destructive dark:bg-destructive/20 border-destructive/30",
				outline:
					"border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
				ghost:
					"hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50 border-transparent",
				link: "text-primary underline-offset-4 hover:underline border-transparent",
				// Variantes para badges de estado de revisores
				primarySoft:
					"bg-blue-500/20 text-blue-400 border-blue-500/40 dark:bg-blue-500/25 dark:text-blue-300 dark:border-blue-400/50",
				neutral:
					"bg-zinc-500/20 text-zinc-400 border-zinc-500/40 dark:bg-zinc-500/25 dark:text-zinc-300 dark:border-zinc-400/50",
				warning:
					"bg-amber-500/20 text-amber-500 border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-400 dark:border-amber-400/50",
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
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "span";

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
