"use client";

import { useMutation } from "convex/react";
import {
	CalendarCheck,
	CalendarOff,
	Check,
	Ellipsis,
	Hash,
	Pencil,
	X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Input } from "@/components/ui/input";
import { WithTooltip } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { useConvexTags } from "@/hooks/useConvexTags";
import { getInitials } from "@/lib/initials";
import { findNextScheduledAbsence } from "@/lib/plannedAbsences";
import { reviewerHasBirthdayToday } from "@/lib/reviewerAvailability";
import { isEligibleForAssignment } from "@/lib/reviewerEligibility";
import type { Reviewer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { rotationQueue } from "./assignment/assignmentCard.utils";
import { EditReviewerDialog } from "./dialogs/EditReviewerDialog";
import { MarkAbsentDialog } from "./dialogs/MarkAbsentDialog";
import { PlannedAbsenceChip } from "./PlannedAbsenceChip";
import { usePRReview } from "./PRReviewContext";

interface ReviewersTableProps {
	teamSlug?: string;
	readOnly?: boolean;
	/** The rotation the list is ordered by; `undefined` is the general one. */
	rotationTagId?: Id<"tags">;
}

/**
 * The team in the order the rotation will pick them, then whoever is out of
 * it (absent or outside the pool) in a dimmed group at the end.
 */
export function ReviewersTable({
	teamSlug,
	readOnly = false,
	rotationTagId,
}: ReviewersTableProps) {
	const t = useTranslations();
	const locale = useLocale();
	const {
		reviewers,
		showTags,
		onMarkAbsent,
		onMarkAvailable,
		userInfo,
		onDataUpdate,
		updateReviewer,
		canManageCurrentTeam,
		plannedAbsences,
		teamTimezone,
	} = usePRReview();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState<number>(0);
	const [absentFor, setAbsentFor] = useState<Reviewer | null>(null);
	const [editFor, setEditFor] = useState<Reviewer | null>(null);
	const { tags } = useConvexTags(teamSlug);
	const updateAssignmentCountMutation = useMutation(
		api.mutations.updateAssignmentCount,
	);
	const canEdit = canManageCurrentTeam && !readOnly;

	const listed = rotationTagId
		? reviewers.filter((reviewer) => reviewer.tags?.includes(rotationTagId))
		: reviewers;
	const queue = rotationQueue(
		listed.filter((reviewer) =>
			isEligibleForAssignment(reviewer, rotationTagId),
		),
		[],
	);
	const queueIds = new Set(queue.map((reviewer) => String(reviewer._id)));
	const outOfRotation = listed.filter(
		(reviewer) => !queueIds.has(String(reviewer._id)),
	);

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

	const tagNames = (reviewer: Reviewer) =>
		showTags
			? (reviewer.tags ?? [])
					.map((tagId) => tags.find((tag) => tag._id === tagId)?.name)
					.filter((name): name is string => Boolean(name))
			: [];

	const absenceDetail = (reviewer: Reviewer) => {
		if (reviewer.absenceReason === "part_time_schedule")
			return t("partTime.scheduleReason");
		if (reviewer.absenceReason === "manual") {
			return reviewer.absentUntil
				? t("partTime.returningOn", {
						date: new Date(reviewer.absentUntil).toLocaleDateString(locale),
					})
				: t("partTime.noReturnDate");
		}
		return null;
	};

	const renderRow = (reviewer: Reviewer, position: number | null) => {
		const isNext = position === 1;
		const isUnavailable = position === null;
		const scheduledAbsence = findNextScheduledAbsence(
			plannedAbsences,
			reviewer._id,
		);
		const meta = [
			...tagNames(reviewer),
			isUnavailable && reviewer.excludedFromReviewPool === true
				? t("reviewer.outOfReviewPoolBadge")
				: null,
			isUnavailable ? absenceDetail(reviewer) : null,
		]
			.filter((part): part is string => Boolean(part))
			.join(" · ");
		const isEditingCount = editingId === reviewer._id && canEdit;

		return (
			<li
				key={reviewer._id}
				className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/30"
			>
				<span
					className={cn(
						"w-5 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground",
						isUnavailable && "opacity-60",
					)}
				>
					{position ?? "–"}
				</span>
				<Avatar
					className={cn("size-8 shrink-0", isUnavailable && "opacity-60")}
				>
					<AvatarFallback className="text-[13px]">
						{getInitials(reviewer.name)}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-baseline gap-1.5">
						<h3
							className={cn(
								"min-w-0 truncate text-base font-medium leading-none",
								isUnavailable && "text-muted-foreground",
							)}
						>
							{reviewer.name}
						</h3>
						{reviewerHasBirthdayToday(reviewer, teamTimezone) ? (
							<WithTooltip label={t("birthday.todayTooltip")}>
								<span className="shrink-0 self-center text-xs leading-none">
									🎂
								</span>
							</WithTooltip>
						) : null}
						{isNext ? (
							<span className="shrink-0 text-[13px] font-medium leading-none text-primary">
								{t("pr.next")}
							</span>
						) : null}
					</div>
					{meta || scheduledAbsence ? (
						<div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
							{meta ? (
								<p className="min-w-0 truncate text-[13px] text-muted-foreground">
									{meta}
								</p>
							) : null}
							{scheduledAbsence ? (
								<PlannedAbsenceChip
									absence={scheduledAbsence}
									reviewer={reviewer}
									variant="short"
									canEdit={canEdit}
									className="px-2 text-[13px] leading-5"
								/>
							) : null}
						</div>
					) : null}
				</div>

				{isEditingCount ? (
					<div className="flex shrink-0 items-center gap-0.5">
						<Input
							type="number"
							value={editValue}
							onChange={(event) =>
								setEditValue(Number.parseInt(event.target.value, 10) || 0)
							}
							className="h-7 w-12 px-1.5 text-xs"
							min={0}
							autoFocus
							aria-label={t("reviewer.assignmentsOf", { name: reviewer.name })}
						/>
						<IconActionButton
							label={t("common.save")}
							className="size-7"
							onClick={() => void saveEditing()}
						>
							<Check className="text-green-600" />
						</IconActionButton>
						<IconActionButton
							label={t("common.cancel")}
							className="size-7"
							onClick={() => setEditingId(null)}
						>
							<X className="text-destructive" />
						</IconActionButton>
					</div>
				) : (
					<span className="flex shrink-0 items-baseline gap-1 px-1.5 text-muted-foreground">
						<span className="text-sm font-medium tabular-nums">
							{reviewer.assignmentCount}
						</span>
						<span className="text-[13px] font-normal">
							{t("pr.assignmentsUnit", { count: reviewer.assignmentCount })}
						</span>
					</span>
				)}

				{canEdit ? (
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<IconActionButton
								label={t("reviewersPanel.moreActions")}
								className="size-7 text-muted-foreground"
							>
								<Ellipsis />
							</IconActionButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							{reviewer.manualIsAbsent ? (
								<DropdownMenuItem
									onSelect={() => void onMarkAvailable(reviewer._id)}
								>
									<CalendarCheck />
									{t("absent.markAvailable")}
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem onSelect={() => setAbsentFor(reviewer)}>
									<CalendarOff />
									{t("absent.markAbsent")}
								</DropdownMenuItem>
							)}
							<DropdownMenuItem
								onSelect={() => {
									setEditingId(reviewer._id);
									setEditValue(reviewer.assignmentCount);
								}}
							>
								<Hash />
								{t("reviewer.editAssignments")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={() => setEditFor(reviewer)}>
								<Pencil />
								{t("common.edit")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</li>
		);
	};

	return (
		<div className="flex flex-col gap-3">
			<ol className="flex flex-col">
				{queue.map((reviewer, index) => renderRow(reviewer, index + 1))}
			</ol>
			{outOfRotation.length > 0 ? (
				<>
					<p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
						{t("reviewersPanel.absentGroup")}
					</p>
					<ul className="flex flex-col">
						{outOfRotation.map((reviewer) => renderRow(reviewer, null))}
					</ul>
				</>
			) : null}

			{absentFor ? (
				<MarkAbsentDialog
					isOpen
					onOpenChange={(open) => {
						if (!open) setAbsentFor(null);
					}}
					reviewer={absentFor}
					currentUser={userInfo}
					onMarkAbsent={async (absentUntil) => {
						await onMarkAbsent(absentFor._id, absentUntil);
					}}
				/>
			) : null}
			{editFor ? (
				<EditReviewerDialog
					reviewer={editFor}
					open
					onOpenChange={(open) => {
						if (!open) setEditFor(null);
					}}
					onUpdateReviewer={updateReviewer}
				/>
			) : null}
		</div>
	);
}
