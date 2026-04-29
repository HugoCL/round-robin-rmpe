import { Badge } from "@/ui/badge";
import type {
	AssignmentMode,
	SlotConfig,
	SlotPreview,
	SlotStrategy,
} from "../types";

interface SlotConfiguratorProps {
	mode: AssignmentMode;
	slots: SlotConfig[];
	previews: SlotPreview[];
	reviewers: Array<{
		_id: string;
		name: string;
		email: string;
		effectiveIsAbsent: boolean;
		excludedFromReviewPool?: boolean;
		tags: string[];
	}>;
	tags: Array<{ _id: string; name: string; color: string }>;
	selectedTagId?: string | null;
	reviewerCount: number;
	onReviewerCountChange: (count: number) => void;
	onSlotChange: (index: number, patch: Partial<SlotConfig>) => void;
	maxCount: number;
}

const MAX_SLOTS = 5;

export function SlotConfigurator({
	mode,
	slots,
	previews,
	reviewers,
	tags,
	selectedTagId,
	reviewerCount,
	onReviewerCountChange,
	onSlotChange,
	maxCount,
}: SlotConfiguratorProps) {
	const availableReviewers = reviewers.filter(
		(r) => r.excludedFromReviewPool !== true && !r.effectiveIsAbsent,
	);

	const strategyOptions: Array<{ value: SlotStrategy; label: string }> =
		mode === "regular"
			? [
					{ value: "random", label: "Aleatorio (round-robin)" },
					{ value: "specific", label: "Revisor específico" },
				]
			: [
					{ value: "tag_random_selected", label: "Etiqueta seleccionada" },
					{ value: "tag_random_other", label: "Otra etiqueta" },
					{ value: "specific", label: "Revisor específico" },
				];

	return (
		<div className="mx-4 mt-2 space-y-2">
			{/* Reviewer count stepper */}
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
					Revisores
				</span>
				<div className="inline-flex items-center gap-0.5 rounded-md border border-input bg-background p-0.5">
					<button
						type="button"
						onClick={() =>
							onReviewerCountChange(Math.max(2, reviewerCount - 1))
						}
						disabled={reviewerCount <= 2}
						className="size-6 flex items-center justify-center rounded text-xs font-medium hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>
						−
					</button>
					<span className="w-5 text-center text-xs font-semibold text-foreground">
						{reviewerCount}
					</span>
					<button
						type="button"
						onClick={() =>
							onReviewerCountChange(
								Math.min(Math.min(MAX_SLOTS, maxCount), reviewerCount + 1),
							)
						}
						disabled={reviewerCount >= Math.min(MAX_SLOTS, maxCount)}
						className="size-6 flex items-center justify-center rounded text-xs font-medium hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>
						+
					</button>
				</div>
			</div>

			{/* Slot fieldsets */}
			<div className="space-y-1.5">
				{slots.map((slot, slotIndex) => {
					const preview = previews.find((p) => p.slotIndex === slotIndex);
					const requiresReviewer = slot.strategy === "specific";
					const requiresTag = slot.strategy === "tag_random_other";

					return (
						<div
							key={slot.id}
							className="rounded border border-border bg-card/70 px-2.5 py-2 space-y-1.5"
						>
							{/* Slot header */}
							<div className="flex items-center gap-1.5">
								<span className="flex-shrink-0 size-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center dark:bg-white/10 dark:text-white">
									{slotIndex + 1}
								</span>
								<span className="text-[10px] font-semibold text-foreground">
									Revisor #{slotIndex + 1}
								</span>
							</div>

							{/* Strategy selector */}
							<select
								value={slot.strategy}
								onChange={(e) =>
									onSlotChange(slotIndex, {
										strategy: e.target.value as SlotStrategy,
										reviewerId: undefined,
										tagId: undefined,
									})
								}
								className="w-full text-xs px-2 py-1.5 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
							>
								{strategyOptions.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>

							{/* Per-slot tag picker */}
							{requiresTag && (
								<select
									value={slot.tagId ?? ""}
									onChange={(e) =>
										onSlotChange(slotIndex, {
											tagId: e.target.value || undefined,
										})
									}
									className="w-full text-xs px-2 py-1.5 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
								>
									<option value="" disabled>
										Seleccionar etiqueta...
									</option>
									{tags.map((tag) => (
										<option key={tag._id} value={tag._id}>
											{tag.name}
										</option>
									))}
								</select>
							)}

							{/* Per-slot reviewer picker */}
							{requiresReviewer && (
								<select
									value={slot.reviewerId ?? ""}
									onChange={(e) =>
										onSlotChange(slotIndex, {
											reviewerId: e.target.value || undefined,
										})
									}
									className="w-full text-xs px-2 py-1.5 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
								>
									<option value="" disabled>
										Seleccionar revisor...
									</option>
									{availableReviewers.map((r) => (
										<option key={r._id} value={r._id}>
											{r.name}
										</option>
									))}
								</select>
							)}

							{/* Preview badge */}
							<div className="flex flex-wrap items-center gap-1 text-[10px]">
								{preview?.status === "resolved" ? (
									<>
										<Badge
											variant="secondary"
											className="text-[9px] px-1.5 py-0 h-auto bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
										>
											✓
										</Badge>
										<span className="text-muted-foreground truncate">
											{preview.reviewerName}
										</span>
										{preview.tagName && (
											<Badge
												variant="outline"
												className="text-[9px] px-1 py-0 h-auto"
											>
												{preview.tagName}
											</Badge>
										)}
									</>
								) : (
									<>
										<Badge
											variant="outline"
											className="text-[9px] px-1.5 py-0 h-auto"
										>
											?
										</Badge>
										<span className="text-muted-foreground truncate">
											{slot.strategy === "tag_random_selected" && !selectedTagId
												? "Selecciona una etiqueta primero"
												: preview?.reason || "Pendiente..."}
										</span>
									</>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
