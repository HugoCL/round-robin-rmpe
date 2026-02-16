"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export const MIN_BATCH_SLOTS = 1;
export const MAX_BATCH_SLOTS = 5;

export type ReviewerSlotStrategy =
	| "random"
	| "specific"
	| "tag_random_selected"
	| "tag_random_other";

export type ReviewerSlotConfig = {
	id: string;
	strategy: ReviewerSlotStrategy;
	reviewerId?: Id<"reviewers">;
	tagId?: Id<"tags">;
};

export type ReviewerSlotPreview = {
	slotIndex: number;
	status: "resolved" | "unresolved";
	reviewerName?: string;
	tagName?: string;
	reason?: string;
};

type Props = {
	mode: "regular" | "tag";
	reviewerCount: number;
	minReviewerCount?: number;
	allowReviewerCountChange?: boolean;
	embedded?: boolean;
	selectedTagId?: Id<"tags">;
	slots: ReviewerSlotConfig[];
	reviewers: Doc<"reviewers">[];
	tags: Doc<"tags">[];
	previews: ReviewerSlotPreview[];
	onReviewerCountChange: (next: number) => void;
	onSlotChange: (index: number, patch: Partial<ReviewerSlotConfig>) => void;
};

export function ReviewerSlotsConfigurator({
	mode,
	reviewerCount,
	minReviewerCount = MIN_BATCH_SLOTS,
	allowReviewerCountChange = true,
	embedded = false,
	selectedTagId,
	slots,
	reviewers,
	tags,
	previews,
	onReviewerCountChange,
	onSlotChange,
}: Props) {
	const t = useTranslations();
	const availableReviewers = reviewers.filter((reviewer) => !reviewer.isAbsent);
	const containerClass = embedded
		? "space-y-3"
		: "space-y-3 rounded-lg border border-muted bg-muted/20 p-3 md:p-4";

	return (
		<section className={containerClass}>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-1 sm:max-w-[70%]">
					<Label htmlFor="reviewer-slots-count">
						{t("pr.reviewersToAssign")}
					</Label>
					<p className="text-xs text-muted-foreground">
						{t("pr.reviewersToAssignDescription")}
					</p>
				</div>
				<div
					className="inline-flex items-center gap-1 self-start rounded-md border bg-background p-1"
					id="reviewer-slots-count"
					aria-label={t("pr.reviewersToAssign")}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						onClick={() =>
							onReviewerCountChange(
								Math.max(minReviewerCount, reviewerCount - 1),
							)
						}
						disabled={
							!allowReviewerCountChange || reviewerCount <= minReviewerCount
						}
						aria-label={t("pr.decreaseReviewerCount")}
					>
						<Minus className="h-4 w-4" aria-hidden="true" />
					</Button>
					<span
						className="min-w-8 text-center text-sm font-medium"
						aria-live="polite"
					>
						{reviewerCount}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						onClick={() =>
							onReviewerCountChange(
								Math.min(MAX_BATCH_SLOTS, reviewerCount + 1),
							)
						}
						disabled={
							!allowReviewerCountChange || reviewerCount >= MAX_BATCH_SLOTS
						}
						aria-label={t("pr.increaseReviewerCount")}
					>
						<Plus className="h-4 w-4" aria-hidden="true" />
					</Button>
				</div>
			</div>

			<div className="space-y-3">
				{slots.map((slot, slotIndex) => {
					const slotPreview = previews.find(
						(preview) => preview.slotIndex === slotIndex,
					);
					const reviewerSelectId = `slot-reviewer-${slot.id}`;
					const strategySelectId = `slot-strategy-${slot.id}`;
					const tagSelectId = `slot-tag-${slot.id}`;
					const strategyOptions =
						mode === "regular"
							? [
									{ value: "random", label: t("pr.slotStrategyRandom") },
									{ value: "specific", label: t("pr.slotStrategySpecific") },
								]
							: [
									{
										value: "tag_random_selected",
										label: t("pr.slotStrategyTagSelected"),
									},
									{
										value: "tag_random_other",
										label: t("pr.slotStrategyTagOther"),
									},
									{ value: "specific", label: t("pr.slotStrategySpecific") },
								];

					const requiresReviewer = slot.strategy === "specific";
					const requiresTag = slot.strategy === "tag_random_other";
					const isTagSelectedMissing =
						slot.strategy === "tag_random_selected" && !selectedTagId;

					return (
						<fieldset
							key={slot.id}
							className="space-y-2 rounded-md border bg-card/70 px-3 pb-3 pt-2 md:px-4 md:pb-4 md:pt-3"
						>
							<legend className="ml-2 bg-card/70 px-2 text-sm font-semibold leading-none">
								{t("pr.reviewerSlotLegend", { index: slotIndex + 1 })}
							</legend>

							<div className="flex flex-col gap-2 md:flex-row">
								<div className="space-y-1 md:min-w-0 md:flex-1">
									<Label htmlFor={strategySelectId}>
										{t("pr.slotTypeLabel")}
									</Label>
									<Select
										value={slot.strategy}
										onValueChange={(value) =>
											onSlotChange(slotIndex, {
												strategy: value as ReviewerSlotStrategy,
												reviewerId: undefined,
												tagId: undefined,
											})
										}
									>
										<SelectTrigger
											id={strategySelectId}
											className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
										>
											<SelectValue placeholder={t("pr.slotTypePlaceholder")} />
										</SelectTrigger>
										<SelectContent>
											{strategyOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{requiresTag && (
									<div className="space-y-1 md:min-w-0 md:flex-1">
										<Label htmlFor={tagSelectId}>{t("pr.slotTagLabel")}</Label>
										<Select
											value={slot.tagId}
											onValueChange={(value) =>
												onSlotChange(slotIndex, { tagId: value as Id<"tags"> })
											}
										>
											<SelectTrigger
												id={tagSelectId}
												className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
											>
												<SelectValue placeholder={t("pr.slotTagPlaceholder")} />
											</SelectTrigger>
											<SelectContent>
												{tags.map((tag) => (
													<SelectItem key={tag._id} value={tag._id}>
														<span className="block min-w-0 truncate">
															{tag.name}
														</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}

								{requiresReviewer && (
									<div className="space-y-1 md:min-w-0 md:flex-1">
										<Label htmlFor={reviewerSelectId}>
											{t("pr.slotReviewerLabel")}
										</Label>
										<Select
											value={slot.reviewerId}
											onValueChange={(value) =>
												onSlotChange(slotIndex, {
													reviewerId: value as Id<"reviewers">,
												})
											}
										>
											<SelectTrigger
												id={reviewerSelectId}
												className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
											>
												<SelectValue
													placeholder={t("pr.slotReviewerPlaceholder")}
												/>
											</SelectTrigger>
											<SelectContent>
												{availableReviewers.map((reviewer) => (
													<SelectItem key={reviewer._id} value={reviewer._id}>
														<span className="block min-w-0 truncate">
															{reviewer.name}
														</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>

							<div
								className="flex flex-wrap items-center gap-2 text-sm"
								aria-live="polite"
							>
								{slotPreview?.status === "resolved" ? (
									<>
										<Badge variant="secondary" className="whitespace-nowrap">
											{t("pr.slotResolvedBadge")}
										</Badge>
										<span className="min-w-0 break-words text-muted-foreground">
											{t("pr.slotResolvedReviewer", {
												reviewer: slotPreview.reviewerName || "-",
											})}
										</span>
										{slotPreview.tagName && (
											<Badge variant="outline" className="max-w-full">
												<span className="block truncate">
													{slotPreview.tagName}
												</span>
											</Badge>
										)}
									</>
								) : (
									<>
										<Badge variant="outline" className="whitespace-nowrap">
											{t("pr.slotUnresolvedBadge")}
										</Badge>
										<span className="min-w-0 break-words text-muted-foreground">
											{isTagSelectedMissing
												? t("pr.slotReasonMissingSelectedTag")
												: slotPreview?.reason || t("pr.slotPending")}
										</span>
									</>
								)}
							</div>
						</fieldset>
					);
				})}
			</div>
		</section>
	);
}
