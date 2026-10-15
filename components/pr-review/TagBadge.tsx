import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Tag colors are picked by users and often fail contrast as text (2:1 is
 * common), so the color goes on a dot and the name stays in the text color.
 */
export function TagBadge({
	name,
	color,
	className,
}: {
	name: string;
	color: string;
	className?: string;
}) {
	return (
		<Badge
			variant="outline"
			className={cn("gap-1.5 text-foreground", className)}
		>
			<span
				aria-hidden="true"
				className="size-1.5 shrink-0 rounded-full"
				style={{ backgroundColor: color }}
			/>
			{name}
		</Badge>
	);
}
