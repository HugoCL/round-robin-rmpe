"use client";

import { useMutation } from "convex/react";
import { Check, Edit, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
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
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { useConvexTags } from "@/hooks/useConvexTags";
import { cn } from "@/lib/utils";
import { EditReviewerDialog } from "./dialogs/EditReviewerDialog";
import { MarkAbsentDialog } from "./dialogs/MarkAbsentDialog";

interface ReviewersTableProps {
	teamSlug?: string;
}

import { usePRReview } from "./PRReviewContext";

export function ReviewersTable({ teamSlug }: ReviewersTableProps) {
	const t = useTranslations();
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
	} = usePRReview();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState<number>(0);
	const [absentDialogOpen, setAbsentDialogOpen] = useState(false);
	const [selectedReviewer, setSelectedReviewer] =
		useState<Doc<"reviewers"> | null>(null);
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
		const tag = tags.find((t) => t._id === tagId);
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

	return (
		<div className="space-y-4">
			<section className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
				<div className="min-w-0">
					<h4 className="text-sm font-semibold">{t("common.viewOptions")}</h4>
					<p className="truncate text-xs text-muted-foreground">
						{t("pr.reviewersViewOptionsDescription")}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Badge variant="neutral" size="xs">
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

			<Table>
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
								reviewer.isAbsent ? "opacity-60" : "hover:bg-muted/40",
							)}
						>
							<TableCell className="font-medium">
								<div className="flex items-center gap-3">
									<Avatar className="h-8 w-8">
										<AvatarFallback>
											{reviewer.name?.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="truncate max-w-[16ch]">{reviewer.name}</span>
									{nextReviewer?._id === reviewer._id && (
										<Badge variant="primarySoft" size="xs">
											{t("pr.next")}
										</Badge>
									)}
									{assignmentFeed.lastAssigned &&
										assignmentFeed.lastAssigned.reviewerId === reviewer._id && (
											<Badge variant="neutral" size="xs">
												{t("pr.lastAssigned")}
											</Badge>
										)}
								</div>
							</TableCell>
							{showEmails && (
								<TableCell className="text-sm text-muted-foreground">
									{reviewer.email}
								</TableCell>
							)}
							{showTags && (
								<TableCell>
									<div className="flex flex-wrap gap-1">
										{reviewer.tags && reviewer.tags.length > 0 ? (
											reviewer.tags.map((tagId: string) => getTagBadge(tagId))
										) : (
											<span className="text-sm text-muted-foreground">
												{t("pr.noTags")}
											</span>
										)}
									</div>
								</TableCell>
							)}
							{showAssignments && (
								<TableCell>
									{editingId === reviewer._id ? (
										<div className="flex items-center space-x-2">
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
										<div className="flex items-center space-x-2">
											<span>{reviewer.assignmentCount}</span>
											<Button
												size="icon"
												variant="ghost"
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
								<div className="flex items-center space-x-2">
									<Switch
										id={`absence-${reviewer._id}`}
										checked={!reviewer.isAbsent}
										onCheckedChange={(checked) => {
											if (!checked) {
												// User is marking as absent - show dialog
												setSelectedReviewer(reviewer);
												setAbsentDialogOpen(true);
											} else {
												// User is marking as available - call directly
												onMarkAvailable(reviewer._id);
											}
										}}
									/>
									<Label htmlFor={`absence-${reviewer._id}`}>
										{reviewer.isAbsent ? t("pr.absent") : t("pr.available")}
									</Label>
									{reviewer.isAbsent && reviewer.absentUntil && (
										<span className="whitespace-nowrap text-[11px] text-muted-foreground">
											({new Date(reviewer.absentUntil).toLocaleDateString()})
										</span>
									)}
								</div>
							</TableCell>
							<TableCell>
								<EditReviewerDialog
									reviewer={reviewer}
									onUpdateReviewer={async (id, name, email, googleChatUserId) =>
										updateReviewer(id, name, email, googleChatUserId)
									}
									trigger={
										<Button
											size="icon"
											variant="ghost"
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
