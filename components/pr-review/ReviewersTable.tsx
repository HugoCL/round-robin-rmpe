"use client";

import { useMutation } from "convex/react";
import { Check, Edit, SlidersHorizontal, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { useConvexTags } from "@/hooks/useConvexTags";
import type { Reviewer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EditReviewerDialog } from "./dialogs/EditReviewerDialog";
import { MarkAbsentDialog } from "./dialogs/MarkAbsentDialog";

interface ReviewersTableProps {
	teamSlug?: string;
	showViewControls?: boolean;
}

import { usePRReview } from "./PRReviewContext";

export function ReviewersTable({
	teamSlug,
	showViewControls = true,
}: ReviewersTableProps) {
	const t = useTranslations();
	const locale = useLocale();
	const {
		reviewers,
		nextReviewer,
		assignmentFeed,
		showAssignments,
		showTags,
		showEmails,
		toggleShowAssignments,
		toggleShowTags,
		toggleShowEmails,
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
	const visibleColumnsCount = [showAssignments, showTags, showEmails].filter(
		Boolean,
	).length;

	// Use Convex for real-time tags
	const { tags } = useConvexTags(teamSlug);

	// Use Convex mutation for updating assignment count
	const updateAssignmentCountMutation = useMutation(
		api.mutations.updateAssignmentCount,
	);

	const startEditing = (id: string, currentValue: number) => {
		setEditingId(id);
		setEditValue(currentValue);
	};

	const cancelEditing = () => {
		setEditingId(null);
	};

	const saveEditing = async () => {
		if (!canManageCurrentTeam) return;
		if (!editingId) return;

		// Validate input
		if (editValue < 0 || Number.isNaN(editValue)) {
			toast({
				title: t("common.error"),
				description: t("reviewer.assignmentCount"),
				variant: "destructive",
			});
			return;
		}

		try {
			// Update using Convex mutation
			await updateAssignmentCountMutation({
				id: editingId as Id<"reviewers">,
				count: editValue,
			});

			// Refresh data to get updated reviewers
			await onDataUpdate();

			toast({
				title: t("common.success"),
				description: t("reviewer.countUpdated"),
			});

			// Exit edit mode
			setEditingId(null);
		} catch (_error) {
			toast({
				title: t("common.error"),
				description: t("reviewer.countUpdateFailed"),
				variant: "destructive",
			});
		}
	};

	const getTagBadge = (tagId: string) => {
		const tag = tags.find(
			(t: { _id: string; name: string; color: string }) => t._id === tagId,
		);
		if (!tag) return null;

		return (
			<Badge
				key={tagId}
				variant="secondary"
				className="text-xs"
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
		<div className="flex flex-col gap-4">
			{showViewControls && (
				<section className="flex justify-end">
					<div className="flex shrink-0 items-center gap-2">
						<Badge variant="secondary" className="h-5 px-2 py-0.5 text-xs">
							{visibleColumnsCount}/3
						</Badge>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm" className="h-8 gap-2">
									<SlidersHorizontal className="h-3.5 w-3.5" />
									{t("pr.viewColumns")}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-72">
								<DropdownMenuLabel>{t("common.viewOptions")}</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={showAssignments}
									onSelect={(event) => event.preventDefault()}
									onCheckedChange={(checked) => {
										if (checked !== showAssignments) toggleShowAssignments();
									}}
								>
									<div className="space-y-1">
										<p>{t("pr.showAssignments")}</p>
										<p className="text-[11px] text-muted-foreground">
											{t("pr.showAssignmentsDescription")}
										</p>
									</div>
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={showTags}
									onSelect={(event) => event.preventDefault()}
									onCheckedChange={(checked) => {
										if (checked !== showTags) toggleShowTags();
									}}
								>
									<div className="space-y-1">
										<p>{t("pr.showTags")}</p>
										<p className="text-[11px] text-muted-foreground">
											{t("pr.showTagsDescription")}
										</p>
									</div>
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={showEmails}
									onSelect={(event) => event.preventDefault()}
									onCheckedChange={(checked) => {
										if (checked !== showEmails) toggleShowEmails();
									}}
								>
									<div className="space-y-1">
										<p>{t("pr.showEmails")}</p>
										<p className="text-[11px] text-muted-foreground">
											{t("pr.showEmailsDescription")}
										</p>
									</div>
								</DropdownMenuCheckboxItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</section>
			)}

			<Table className="text-sm lg:text-base">
				<TableHeader>
					<TableRow>
						<TableHead>{t("pr.nameHeader")}</TableHead>
						{showEmails && <TableHead>{t("common.email")}</TableHead>}
						{showTags && <TableHead>{t("pr.tagsHeader")}</TableHead>}
						{showAssignments && (
							<TableHead>{t("pr.assignmentsHeader")}</TableHead>
						)}
						<TableHead>{t("pr.statusHeader")}</TableHead>
						<TableHead className="w-16"></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{reviewers.map((reviewer) => (
						<TableRow
							key={reviewer._id}
							className={cn(
								"group transition-colors",
								reviewer.effectiveIsAbsent ? "opacity-60" : "hover:bg-muted/40",
							)}
						>
							<TableCell className="font-medium lg:text-base">
								<div className="flex items-center gap-3">
									<Avatar className="size-8 lg:size-9">
										<AvatarFallback>
											{reviewer.name?.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="max-w-[16ch] truncate lg:max-w-[22ch]">
										{reviewer.name}
									</span>
									{nextReviewer?._id === reviewer._id && (
										<Badge
											variant="default"
											className="h-5 px-2 py-0.5 text-xs"
										>
											{t("pr.next")}
										</Badge>
									)}
									{assignmentFeed.lastAssigned &&
										assignmentFeed.lastAssigned.reviewerId === reviewer._id && (
											<Badge
												variant="secondary"
												className="h-5 px-2 py-0.5 text-xs"
											>
												{t("pr.lastAssigned")}
											</Badge>
										)}
								</div>
							</TableCell>
							{showEmails && (
								<TableCell className="text-sm text-muted-foreground lg:text-base">
									{reviewer.email}
								</TableCell>
							)}
							{showTags && (
								<TableCell>
									<div className="flex flex-wrap gap-1">
										{reviewer.tags && reviewer.tags.length > 0 ? (
											reviewer.tags.map((tagId: string) => getTagBadge(tagId))
										) : (
											<span className="text-sm text-muted-foreground lg:text-base">
												{t("pr.noTags")}
											</span>
										)}
									</div>
								</TableCell>
							)}
							{showAssignments && (
								<TableCell>
									{editingId === reviewer._id ? (
										<div className="flex items-center gap-2">
											<Input
												type="number"
												value={editValue}
												onChange={(e) =>
													setEditValue(Number.parseInt(e.target.value, 10) || 0)
												}
												className="w-20"
												min={0}
											/>
											<Button size="icon" variant="ghost" onClick={saveEditing}>
												<Check className="h-4 w-4 text-green-500" />
											</Button>
											<Button
												size="icon"
												variant="ghost"
												onClick={cancelEditing}
											>
												<X className="h-4 w-4 text-red-500" />
											</Button>
										</div>
									) : (
										<div className="flex items-center gap-2">
											<span className="lg:text-base">
												{reviewer.assignmentCount}
											</span>
											<Button
												size="icon"
												variant="ghost"
												disabled={!canManageCurrentTeam}
												onClick={() =>
													startEditing(reviewer._id, reviewer.assignmentCount)
												}
											>
												<Edit className="h-3 w-3 text-muted-foreground" />
											</Button>
										</div>
									)}
								</TableCell>
							)}
							<TableCell>
								<div className="flex flex-wrap items-center gap-3">
									<div className="flex items-center border-r border-border/60 pr-3">
										<Switch
											id={`absence-${reviewer._id}`}
											aria-label={t("partTime.manualControl")}
											checked={!reviewer.manualIsAbsent}
											disabled={!canManageCurrentTeam}
											onCheckedChange={(checked) => {
												if (!canManageCurrentTeam) return;
												if (!checked) {
													setSelectedReviewer(reviewer);
													setAbsentDialogOpen(true);
												} else {
													onMarkAvailable(reviewer._id);
												}
											}}
										/>
										<Label
											htmlFor={`absence-${reviewer._id}`}
											className="sr-only"
										>
											{t("partTime.manualControl")}
										</Label>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<Badge
											variant={
												reviewer.effectiveIsAbsent ? "secondary" : "default"
											}
											className="h-5 px-2 py-0.5 text-xs"
										>
											{reviewer.effectiveIsAbsent
												? t("pr.absent")
												: t("pr.available")}
										</Badge>
										{getStatusDetail(reviewer) && (
											<span className="whitespace-nowrap text-xs text-muted-foreground">
												{getStatusDetail(reviewer)}
											</span>
										)}
									</div>
								</div>
							</TableCell>
							<TableCell>
								<EditReviewerDialog
									reviewer={reviewer}
									onUpdateReviewer={async (
										id,
										name,
										email,
										googleChatUserId,
										partTimeSchedule,
									) =>
										updateReviewer(
											id,
											name,
											email,
											googleChatUserId,
											partTimeSchedule,
										)
									}
									trigger={
										<Button
											size="icon"
											variant="ghost"
											disabled={!canManageCurrentTeam}
											className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
											aria-label={t("common.edit")}
										>
											<Edit className="h-4 w-4 text-muted-foreground" />
										</Button>
									}
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>

				{/* Mark Absent Dialog */}
				{selectedReviewer && (
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
				)}
			</Table>
		</div>
	);
}
