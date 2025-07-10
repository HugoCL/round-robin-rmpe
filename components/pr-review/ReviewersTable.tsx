"use client";

import { Check, Edit, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
	type AssignmentFeed,
	type Reviewer,
	type Tag,
	updateAssignmentCount,
	getTags,
} from "@/app/[locale]/actions";
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

interface ReviewersTableProps {
	reviewers: Reviewer[];
	nextReviewer: Reviewer | null;
	assignmentFeed: AssignmentFeed;
	showAssignments: boolean;
	showTags: boolean;
	onToggleAbsence: (id: string) => Promise<void>;
	onDataUpdate: () => Promise<void>;
}

export function ReviewersTable({
	reviewers,
	nextReviewer,
	assignmentFeed,
	showAssignments,
	showTags,
	onToggleAbsence,
	onDataUpdate,
}: ReviewersTableProps) {
	const t = useTranslations();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState<number>(0);
	const [tags, setTags] = useState<Tag[]>([]);

	const loadTags = useCallback(async () => {
		try {
			const tagsData = await getTags();
			setTags(tagsData);
		} catch (error) {
			console.error("Error loading tags:", error);
		}
	}, []);

	useEffect(() => {
		loadTags();
	}, [loadTags]);

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

		// Update in Redis
		const success = await updateAssignmentCount(editingId, editValue);

		if (success) {
			// Refresh data to get updated reviewers
			await onDataUpdate();

			toast({
				title: t("common.success"),
				description: t("reviewer.countUpdated"),
			});

			// Exit edit mode
			setEditingId(null);
		} else {
			toast({
				title: t("common.error"),
				description: t("reviewer.countUpdateFailed"),
				variant: "destructive",
			});
		}
	};

	const getTagBadge = (tagId: string) => {
		const tag = tags.find((t) => t.id === tagId);
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
					{showTags && <TableHead>{t("pr.tagsHeader")}</TableHead>}
					{showAssignments && (
						<TableHead>{t("pr.assignmentsHeader")}</TableHead>
					)}
					<TableHead>{t("pr.statusHeader")}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{reviewers.map((reviewer) => (
					<TableRow
						key={reviewer.id}
						className={reviewer.isAbsent ? "opacity-60" : ""}
					>
						<TableCell className="font-medium">
							{reviewer.name}
							{nextReviewer?.id === reviewer.id && (
								<Badge className="ml-2 bg-green-500 text-white">
									{t("pr.next")}
								</Badge>
							)}
							{assignmentFeed.lastAssigned?.reviewerId === reviewer.id && (
								<Badge className="ml-2 bg-blue-500 text-white">
									{t("pr.lastAssigned")}
								</Badge>
							)}
						</TableCell>
						{showTags && (
							<TableCell>
								<div className="flex flex-wrap gap-1">
									{reviewer.tags && reviewer.tags.length > 0 ? (
										reviewer.tags.map((tagId) => getTagBadge(tagId))
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
								{editingId === reviewer.id ? (
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
												startEditing(reviewer.id, reviewer.assignmentCount)
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
									id={`absence-${reviewer.id}`}
									checked={!reviewer.isAbsent}
									onCheckedChange={() => onToggleAbsence(reviewer.id)}
								/>
								<Label htmlFor={`absence-${reviewer.id}`}>
									{reviewer.isAbsent ? t("pr.absent") : t("pr.available")}
								</Label>
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
