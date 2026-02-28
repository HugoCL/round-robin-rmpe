import { Alert, AlertDescription } from "@/ui/alert";
import { Button } from "@/ui/button";

interface ErrorMessageProps {
	message: string;
	onDismiss: () => void;
}

export function ErrorMessage({ message, onDismiss }: ErrorMessageProps) {
	return (
		<Alert variant="destructive" className="mx-4 mt-2">
			<svg
				className="size-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={2}
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
			<AlertDescription className="flex items-center justify-between gap-2">
				<span className="truncate">{message}</span>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onDismiss}
					className="text-destructive hover:text-destructive shrink-0"
				>
					<svg
						className="size-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</Button>
			</AlertDescription>
		</Alert>
	);
}
