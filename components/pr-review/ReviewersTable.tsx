"use client";

import { Check, Edit, X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";
import { EditReviewerDialog } from "./dialogs/EditReviewerDialog";
import { useConvexTags } from "@/hooks/useConvexTags";

interface AssignmentFeedType {
	lastAssigned?: string; // Reviewer ID only (not full object)
}

interface ReviewersTableProps {
	reviewers: Doc<"reviewers">[];
	nextReviewer: Doc<"reviewers"> | null;
	assignmentFeed: AssignmentFeedType;
	showAssignments: boolean;
	showTags: boolean;
	showEmails: boolean;
	onToggleAbsence: (id: string) => Promise<void>;
	onDataUpdate: () => Promise<void>;
	updateReviewer: (id: string, name: string, email: string) => Promise<boolean>;
	teamSlug?: string;
}

export function ReviewersTable({
	reviewers,
	nextReviewer,
	assignmentFeed,
	showAssignments,
	showTags,
	showEmails,
	onToggleAbsence,
	onDataUpdate,
	updateReviewer,
	teamSlug,
}: ReviewersTableProps) {
	const t = useTranslations();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState<number>(0);

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
						className={reviewer.isAbsent ? "opacity-60" : ""}
					>
						<TableCell className="font-medium">
							<div className="flex items-center gap-2">
								<span>{reviewer.name}</span>
								{nextReviewer?._id === reviewer._id && (
									<Badge className="bg-green-500 text-white">
										{t("pr.next")}
									</Badge>
								)}
								{assignmentFeed.lastAssigned === reviewer._id && (
									<Badge className="bg-blue-500 text-white">
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
												setEditValue(Number.parseInt(e.target.value) || 0)
											}
											className="w-20"
											min={0}
										/>
										<Button size="icon" variant="ghost" onClick={saveEditing}>
											<Check className="h-4 w-4 text-green-500" />
										</Button>
										<Button size="icon" variant="ghost" onClick={cancelEditing}>
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
									onCheckedChange={() => onToggleAbsence(reviewer._id)}
								/>
								<Label htmlFor={`absence-${reviewer._id}`}>
									{reviewer.isAbsent ? t("pr.absent") : t("pr.available")}
								</Label>
							</div>
						</TableCell>
						<TableCell>
							<EditReviewerDialog
								reviewer={reviewer}
								onUpdateReviewer={updateReviewer}
								trigger={
									<Button size="icon" variant="ghost" className="h-8 w-8">
										<Edit className="h-4 w-4 text-muted-foreground" />
									</Button>
								}
							/>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
