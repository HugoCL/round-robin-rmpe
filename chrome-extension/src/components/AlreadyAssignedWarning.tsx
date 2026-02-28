import { Alert, AlertDescription } from "@/ui/alert";

interface AlreadyAssignedWarningProps {
	reviewerName: string;
	timestamp: number;
}

export function AlreadyAssignedWarning({
	reviewerName,
	timestamp,
}: AlreadyAssignedWarningProps) {
	const date = new Date(timestamp);
	const timeAgo = getTimeAgo(date);

	return (
		<Alert variant="warning" className="mx-4 mt-2">
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
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<AlertDescription>
				Ya asignado a <strong>{reviewerName}</strong> {timeAgo}
			</AlertDescription>
		</Alert>
	);
}

function getTimeAgo(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "justo ahora";
	if (diffMins < 60) return `hace ${diffMins}m`;
	if (diffHours < 24) return `hace ${diffHours}h`;
	return `hace ${diffDays}d`;
}
