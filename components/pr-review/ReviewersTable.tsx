"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, Settings, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WithTooltip } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { useConvexTags } from "@/hooks/useConvexTags";
import { reviewerHasBirthdayToday } from "@/lib/reviewerAvailability";
import type { Reviewer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EditReviewerDialog } from "./dialogs/EditReviewerDialog";
import { MarkAbsentDialog } from "./dialogs/MarkAbsentDialog";
import { usePRReview } from "./PRReviewContext";

interface ReviewersTableProps {
	teamSlug?: string;
	readOnly?: boolean;
}

function getInitials(name?: string) {
	return (
		name
			?.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0])
			.join("")
			.toUpperCase() || "?"
	);
}

export function ReviewersTable({
	teamSlug,
	readOnly = false,
}: ReviewersTableProps) {
	const t = useTranslations();
	const locale = useLocale();
	const {
		reviewers,
		nextReviewer,
		showTags,
		onMarkAbsent,
		onMarkAvailable,
		userInfo,
		onDataUpdate,
		updateReviewer,
		canManageCurrentTeam,
	} = usePRReview();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState<number>(0);
	const [absentDialogOpen, setAbsentDialogOpen] = useState(false);
	const [selectedReviewer, setSelectedReviewer] = useState<Reviewer | null>(
		null,
	);
	const team = useQuery(api.queries.getTeam, teamSlug ? { teamSlug } : "skip");
	const teamTimezone = team?.timezone ?? "UTC";
	const { tags } = useConvexTags(teamSlug);
	const updateAssignmentCountMutation = useMutation(
		api.mutations.updateAssignmentCount,
	);
	const canEdit = canManageCurrentTeam && !readOnly;

	const startEditing = (id: string, currentValue: number) => {
		setEditingId(id);
		setEditValue(currentValue);
	};

	const cancelEditing = () => {
		setEditingId(null);
	};

	const saveEditing = async () => {
		if (!canEdit || !editingId) return;
		if (editValue < 0 || Number.isNaN(editValue)) {
			toast({
				title: t("common.error"),
				description: t("reviewer.assignmentCount"),
				variant: "destructive",
			});
			return;
		}

		try {
			await updateAssignmentCountMutation({
				id: editingId as Id<"reviewers">,
				count: editValue,
			});
			await onDataUpdate();
			toast({
				title: t("common.success"),
				description: t("reviewer.countUpdated"),
			});
			setEditingId(null);
		} catch {
			toast({
				title: t("common.error"),
				description: t("reviewer.countUpdateFailed"),
				variant: "destructive",
			});
		}
	};

	const getTagBadge = (tagId: string) => {
		const tag = tags.find(
			(item: { _id: string; name: string; color: string }) =>
				item._id === tagId,
		);
		if (!tag) return null;

		return (
			<Badge
				key={tagId}
				variant="secondary"
				className="h-4 px-1.5 text-[10px] font-medium"
				style={{
					backgroundColor: `${tag.color}20`,
					color: tag.color,
					borderColor: tag.color,
				}}
			>
				{tag.name}
			</Badge>
		);
	};

	const getStatusDetail = (reviewer: Reviewer) => {
		if (reviewer.absenceReason === "part_time_schedule") {
			return t("partTime.scheduleReason");
		}

		if (reviewer.absenceReason === "manual") {
			if (reviewer.absentUntil) {
				return t("partTime.returningOn", {
					date: new Date(reviewer.absentUntil).toLocaleDateString(locale),
				});
			}
			return t("partTime.noReturnDate");
		}

		return null;
	};

	return (
		<div>
			<div className="divide-y divide-border/60">
				{reviewers.map((reviewer) => {
					const isBirthdayToday = reviewerHasBirthdayToday(
						reviewer,
						teamTimezone,
					);
					const statusDetail = getStatusDetail(reviewer);
					const isNext = nextReviewer?._id === reviewer._id;
					const outOfPool = reviewer.excludedFromReviewPool === true;
					const meta = [
						outOfPool ? t("reviewer.outOfReviewPoolBadge") : null,
						statusDetail,
					]
						.filter((part): part is string => Boolean(part))
						.join(" · ");
					const visibleTags =
						showTags && reviewer.tags?.length > 0 ? reviewer.tags : [];

					return (
						<article
							key={reviewer._id}
							className={cn(
								"group py-2.5 hover:bg-muted/30",
								reviewer.effectiveIsAbsent && "opacity-70",
							)}
						>
							<div className="flex items-center gap-2.5">
								<div className="flex shrink-0 items-center gap-2">
									{canEdit ? (
										<WithTooltip
											label={t("reviewer.availabilitySwitchLabel")}
											side="right"
										>
											<Switch
												id={`absence-${reviewer._id}`}
												size="sm"
												checked={!reviewer.manualIsAbsent}
												aria-label={t("reviewer.availabilitySwitchLabel")}
												onCheckedChange={(checked) => {
													if (!checked) {
														setSelectedReviewer(reviewer);
														setAbsentDialogOpen(true);
													} else {
														void onMarkAvailable(reviewer._id);
													}
												}}
											/>
										</WithTooltip>
									) : null}
									<Avatar className="size-7 shrink-0">
										<AvatarFallback className="text-[11px]">
											{getInitials(reviewer.name)}
										</AvatarFallback>
									</Avatar>
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex min-w-0 items-baseline gap-1.5">
										<h3 className="min-w-0 truncate text-sm font-medium leading-none">
											{reviewer.name}
										</h3>
										{isBirthdayToday ? (
											<WithTooltip label={t("birthday.todayTooltip")}>
												<span className="shrink-0 self-center text-xs leading-none">
													🎂
												</span>
											</WithTooltip>
										) : null}
										{isNext ? (
											<span className="shrink-0 text-[11px] font-medium leading-none text-primary">
												{t("pr.next")}
											</span>
										) : null}
									</div>
									{meta || visibleTags.length > 0 ? (
										<div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
											{meta ? (
												<p className="min-w-0 truncate text-[11px] text-muted-foreground">
													{meta}
												</p>
											) : null}
											{visibleTags.map((tagId) => getTagBadge(tagId))}
										</div>
									) : null}
								</div>
								<div className="flex shrink-0 items-center gap-0.5">
									{editingId === reviewer._id && canEdit ? (
										<div className="flex items-center gap-0.5">
											<Input
												type="number"
												value={editValue}
												onChange={(event) =>
													setEditValue(
														Number.parseInt(event.target.value, 10) || 0,
													)
												}
												className="h-7 w-12 px-1.5 text-xs"
												min={0}
												aria-label={t("pr.assignmentsHeader")}
											/>
											<WithTooltip label={t("common.save")}>
												<Button
													size="icon"
													variant="ghost"
													className="size-7"
													onClick={() => void saveEditing()}
													aria-label={t("common.save")}
												>
													<Check className="h-3.5 w-3.5 text-green-600" />
												</Button>
											</WithTooltip>
											<WithTooltip label={t("common.cancel")}>
												<Button
													size="icon"
													variant="ghost"
													className="size-7"
													onClick={cancelEditing}
													aria-label={t("common.cancel")}
												>
													<X className="h-3.5 w-3.5 text-destructive" />
												</Button>
											</WithTooltip>
										</div>
									) : (
										<WithTooltip
											label={
												canEdit
													? `${t("common.edit")}: ${t("pr.assignmentsHeader")}`
													: t("pr.assignmentsHeader")
											}
										>
											<button
												type="button"
												className={cn(
													"group/count inline-flex items-baseline gap-1 rounded-md px-1.5 py-1 text-muted-foreground",
													canEdit
														? "hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
														: "cursor-default",
												)}
												disabled={!canEdit}
												onClick={() =>
													canEdit &&
													startEditing(reviewer._id, reviewer.assignmentCount)
												}
												aria-label={
													canEdit
														? `${t("common.edit")}: ${t("pr.assignmentsHeader")}`
														: t("pr.assignmentsHeader")
												}
											>
												<span className="text-sm font-medium tabular-nums">
													{reviewer.assignmentCount}
												</span>
												<span className="text-[10px] font-normal text-muted-foreground/75">
													{t("pr.assignmentsUnit")}
												</span>
											</button>
										</WithTooltip>
									)}
									{canEdit ? (
										<EditReviewerDialog
											reviewer={reviewer}
											onUpdateReviewer={async (
												id,
												name,
												email,
												googleChatUserId,
												partTimeSchedule,
												excludedFromReviewPool,
												includedInTagRotations,
											) =>
												updateReviewer(
													id,
													name,
													email,
													googleChatUserId,
													partTimeSchedule,
													excludedFromReviewPool,
													includedInTagRotations,
												)
											}
											trigger={
												<Button
													size="icon"
													variant="ghost"
													className="size-7 text-muted-foreground"
													aria-label={t("reviewer.editReviewer")}
												>
													<Settings className="h-3.5 w-3.5" />
												</Button>
											}
										/>
									) : null}
								</div>
							</div>
						</article>
					);
				})}
			</div>

			{selectedReviewer ? (
				<MarkAbsentDialog
					isOpen={absentDialogOpen}
					onOpenChange={(open) => {
						setAbsentDialogOpen(open);
						if (!open) setSelectedReviewer(null);
					}}
					reviewer={selectedReviewer}
					currentUser={userInfo}
					onMarkAbsent={async (absentUntil) => {
						await onMarkAbsent(selectedReviewer._id, absentUntil);
					}}
				/>
			) : null}
		</div>
	);
}
