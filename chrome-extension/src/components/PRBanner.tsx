import { Skeleton } from "@/ui/skeleton";
import type { PRData } from "../types";

interface PRBannerProps {
	prData: PRData | null;
	loading: boolean;
}

export function PRBanner({ prData, loading }: PRBannerProps) {
	if (loading) {
		return (
			<div className="mx-4 mt-3">
				<Skeleton className="h-4 w-48 mb-1" />
				<Skeleton className="h-3 w-32" />
			</div>
		);
	}

	if (!prData) {
		return (
			<div className="mx-4 mt-3 flex items-center gap-2 text-warning">
				<svg
					className="size-4 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
					/>
				</svg>
				<span className="text-xs font-medium">
					Navega a un PR en GitHub para asignar un revisor
				</span>
			</div>
		);
	}

	return (
		<div className="mx-4 mt-3">
			<div className="flex items-start gap-2">
				<svg
					className="size-4 text-success shrink-0 mt-0.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
				<div className="min-w-0">
					<p className="text-xs font-medium text-foreground truncate">
						{prData.title || `PR #${prData.prNumber}`}
					</p>
					<p className="text-[10px] text-muted-foreground truncate mt-0.5">
						{prData.repoFullName} #{prData.prNumber}
						{prData.author && ` · ${prData.author}`}
					</p>
				</div>
			</div>
		</div>
	);
}
