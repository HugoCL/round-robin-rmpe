import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageIntroProps {
	title: ReactNode;
	description?: ReactNode;
	/** Leading glyph for the kicker; names the area the page belongs to. */
	icon?: ReactNode;
	kicker?: ReactNode;
	/** Page-level actions, aligned to the title block's baseline on wide screens. */
	actions?: ReactNode;
	className?: string;
}

/**
 * The one heading block for pages outside the team board (admin, surveys,
 * suggestions, metrics). Each page used to build its own, so kicker style,
 * title size and action placement drifted from page to page.
 */
export function PageIntro({
	title,
	description,
	icon,
	kicker = "La Lista",
	actions,
	className,
}: PageIntroProps) {
	return (
		<header
			className={cn(
				"page-enter-soft flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
				className,
			)}
		>
			<div className="min-w-0 space-y-2">
				<p className="calm-kicker inline-flex items-center gap-2 [&_svg]:size-3.5">
					{icon}
					{kicker}
				</p>
				<h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
					{title}
				</h1>
				{description ? (
					<p className="max-w-2xl text-pretty text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{actions}
				</div>
			) : null}
		</header>
	);
}
