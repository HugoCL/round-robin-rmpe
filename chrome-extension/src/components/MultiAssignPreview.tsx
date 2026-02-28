import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import type { AssignmentStatus, SlotPreview } from "../types";

interface MultiAssignPreviewProps {
	previews: SlotPreview[];
	resolvedCount: number;
	totalSlots: number;
	status: AssignmentStatus;
	lastAssignedName: string | null;
	lastAssignerName: string | null;
	prUrl: string | null;
	onAssign: () => void;
}

export function MultiAssignPreview({
	previews,
	resolvedCount,
	totalSlots,
	status,
	lastAssignedName,
	lastAssignerName,
	prUrl,
	onAssign,
}: MultiAssignPreviewProps) {
	const isAssigning = status === "assigning";
	const isSuccess = status === "success";
	const canAssign = prUrl && !isAssigning && resolvedCount > 0;

	return (
		<Card className="mx-4 mt-4 overflow-hidden">
			<CardContent className="p-0">
				<div className="text-center py-4 space-y-3">
					{/* "Batch Assignment" badge */}
					<div>
						<span className="inline-flex items-center gap-1.5 bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/25 dark:bg-white/12 dark:text-white dark:ring-white/20">
							<svg
								className="size-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
								/>
							</svg>
							{resolvedCount}/{totalSlots} Revisores
						</span>
					</div>

					{/* Slot preview list */}
					<div className="mx-3 space-y-1">
						{previews.map((preview) => (
							<div
								key={preview.slotIndex}
								className={`relative overflow-hidden p-3 ring-1 border border-white/4 ${
									preview.status === "resolved"
										? "bg-gradient-to-br from-primary/12 via-primary/8 to-primary/4 ring-primary/10 dark:from-primary/20 dark:via-primary/16 dark:to-primary/10 dark:ring-primary/20"
										: "bg-muted/30 ring-border"
								}`}
							>
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2 min-w-0">
										<span
											className={`flex-shrink-0 size-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
												preview.status === "resolved"
													? "bg-primary/20 text-primary dark:bg-white/15 dark:text-white"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{preview.slotIndex + 1}
										</span>
										<span
											className={`text-sm font-semibold truncate transition-all duration-300 ${
												preview.status === "resolved"
													? `text-primary dark:text-white ${isAssigning ? "opacity-50" : ""}`
													: "text-muted-foreground italic"
											}`}
										>
											{preview.status === "resolved"
												? preview.reviewerName
												: (preview.reason ?? "Pendiente...")}
										</span>
									</div>
									{preview.status === "resolved" && preview.tagName && (
										<Badge
											variant="secondary"
											className="text-[9px] px-1 py-0 h-auto flex-shrink-0"
										>
											{preview.tagName}
										</Badge>
									)}
								</div>
							</div>
						))}
						{resolvedCount < totalSlots && resolvedCount > 0 && (
							<p className="text-[10px] text-muted-foreground italic py-1">
								{resolvedCount} de {totalSlots} espacios resueltos
							</p>
						)}
					</div>
				</div>

				{/* Assign button */}
				<div className="px-4 pb-4">
					{isSuccess ? (
						<div className="text-center py-2 space-y-0.5">
							<p className="text-xs text-success font-medium">
								✓ Asignado a <strong>{lastAssignedName}</strong>
							</p>
							{lastAssignerName && (
								<p className="text-[10px] text-muted-foreground">
									por {lastAssignerName}
								</p>
							)}
						</div>
					) : (
						<Button
							onClick={onAssign}
							disabled={!canAssign}
							className="w-full h-10 text-sm"
							size="lg"
						>
							{isAssigning
								? "Asignando..."
								: resolvedCount === 0
									? "Configura los espacios arriba"
									: `Asignar a ${resolvedCount} revisor${resolvedCount !== 1 ? "es" : ""}`}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
