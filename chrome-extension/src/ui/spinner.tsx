import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			role="status"
			aria-label="Loading"
			className={cn(
				"size-5 border-2 border-primary border-t-transparent rounded-full animate-spin",
				className,
			)}
			{...props}
		/>
	);
}

export { Spinner };
