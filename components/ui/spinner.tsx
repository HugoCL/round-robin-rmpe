import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
	const { strokeWidth: _strokeWidth, ...restProps } = props;

	return (
		<HugeiconsIcon
			icon={Loading03Icon}
			strokeWidth={2}
			role="status"
			aria-label="Loading"
			className={cn("size-4 animate-spin", className)}
			{...restProps}
		/>
	);
}

export { Spinner };
