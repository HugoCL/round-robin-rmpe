"use client";

import { X, Edit2, Palette, Save } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

import { usePRReview } from "./PRReviewContext";

const DEFAULT_COLORS = [
	"#3B82F6", // Blue
	"#10B981", // Green
	"#F59E0B", // Amber
	"#8B5CF6", // Purple
	"#EF4444", // Red
	"#06B6D4", // Cyan
	"#84CC16", // Lime
	"#F97316", // Orange
	"#EC4899", // Pink
	"#6B7280", // Gray
];

export function TagManager() {
	const t = useTranslations();
	const { reviewers, onDataUpdate, teamSlug } = usePRReview();

	// Use Convex hooks for real-time data
	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") || [];
	const addTagMutation = useMutation(api.mutations.addTag);
	const updateTagMutation = useMutation(api.mutations.updateTag);
	const removeTagMutation = useMutation(api.mutations.removeTag);
	const assignTagToReviewerMutation = useMutation(
		api.mutations.assignTagToReviewer,
	);
	const removeTagFromReviewerMutation = useMutation(
		api.mutations.removeTagFromReviewer,
	);

	const [isOpen, setIsOpen] = useState(false);
	const [editingTag, setEditingTag] = useState<Doc<"tags"> | null>(null);
	const [newTagName, setNewTagName] = useState("");
	const [newTagColor, setNewTagColor] = useState(DEFAULT_COLORS[0]);
	const [newTagDescription, setNewTagDescription] = useState("");
	const [loading, setLoading] = useState(false);
	const [pendingChanges, setPendingChanges] = useState<{
		[reviewerId: Id<"reviewers">]: { [tagId: Id<"tags">]: boolean };
	}>({});
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	const handleAddTag = async () => {
		if (!teamSlug) {
			toast({
				title: t("common.error"),
				description: t("messages.missingTeam"),
				variant: "destructive",
			});
			return;
		}
		if (!newTagName.trim()) {
			toast({
				title: t("common.error"),
				description: t("messages.enterTagName"),
				variant: "destructive",
			});
			return;
		}

		setLoading(true);
		try {
			await addTagMutation({
				teamSlug,
				name: newTagName,
				color: newTagColor,
				description: newTagDescription,
			});
			setNewTagName("");
			setNewTagDescription("");
			setNewTagColor(DEFAULT_COLORS[0]);
			onDataUpdate?.();
			toast({
				title: t("common.success"),
				description: t("messages.tagAdded"),
			});
		} catch (_error) {
			console.error("Error adding tag:", _error);
			toast({
				title: t("common.error"),
				description: t("messages.addTagFailed"),
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};
	const handleUpdateTag = async () => {
		if (!editingTag) return;

		setLoading(true);
		try {
			await updateTagMutation({
				id: editingTag._id,
				name: editingTag.name,
				color: editingTag.color,
				description: editingTag.description,
			});
			setEditingTag(null);
			toast({
				title: t("common.success"),
				description: t("messages.tagUpdated"),
			});
		} catch (_error) {
			toast({
				title: t("common.error"),
				description: t("messages.updateTagFailed"),
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};
	const handleRemoveTag = async (tagId: Id<"tags">) => {
		if (!confirm(t("tags.removeTagConfirmation"))) {
			return;
		}

		setLoading(true);
		try {
			await removeTagMutation({ id: tagId });
			onDataUpdate?.(); // Refresh reviewers data
			toast({
				title: t("common.success"),
				description: t("messages.tagRemoved"),
			});
		} catch (_error) {
			toast({
				title: t("common.error"),
				description: t("messages.removeTagFailed"),
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleToggleReviewerTag = (
		reviewerId: Id<"reviewers">,
		tagId: Id<"tags">,
		currentState: boolean,
	) => {
		setPendingChanges((prev) => ({
			...prev,
			[reviewerId]: {
				...prev[reviewerId],
				[tagId]: !currentState,
			},
		}));
		setHasUnsavedChanges(true);
	};

	const handleSaveChanges = async () => {
		if (!hasUnsavedChanges) return;

		setLoading(true);
		try {
			const promises = [];

			for (const [reviewerId, tagChanges] of Object.entries(pendingChanges)) {
				for (const [tagId, shouldAssign] of Object.entries(tagChanges)) {
					const reviewerIdTyped = reviewerId as Id<"reviewers">;
					const tagIdTyped = tagId as Id<"tags">;

					const currentlyAssigned =
						reviewers
							.find((r) => r._id === reviewerIdTyped)
							?.tags?.includes(tagIdTyped) || false;

					// Only make changes if the state is different from current
					if (shouldAssign !== currentlyAssigned) {
						if (shouldAssign) {
							promises.push(
								assignTagToReviewerMutation({
									reviewerId: reviewerIdTyped,
									tagId: tagIdTyped,
								}),
							);
						} else {
							promises.push(
								removeTagFromReviewerMutation({
									reviewerId: reviewerIdTyped,
									tagId: tagIdTyped,
								}),
							);
						}
					}
				}
			}

			if (promises.length > 0) {
				await Promise.all(promises);
				setPendingChanges({});
				setHasUnsavedChanges(false);
				onDataUpdate?.(); // Refresh reviewers data
				toast({
					title: t("common.success"),
					description: t("messages.tagAssignmentsSaved"),
				});
			}
		} catch (_error) {
			toast({
				title: t("common.error"),
				description: t("messages.saveChangesFailed"),
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const getReviewerTagState = (
		reviewerId: Id<"reviewers">,
		tagId: Id<"tags">,
	) => {
		// Check if there's a pending change for this reviewer/tag combination
		if (
			pendingChanges[reviewerId] &&
			pendingChanges[reviewerId][tagId] !== undefined
		) {
			return pendingChanges[reviewerId][tagId];
		}
		// Otherwise, return the current state
		return (
			reviewers.find((r) => r._id === reviewerId)?.tags?.includes(tagId) ||
			false
		);
	};

	const resetForm = () => {
		setNewTagName("");
		setNewTagDescription("");
		setNewTagColor(DEFAULT_COLORS[0]);
		setEditingTag(null);
		setPendingChanges({});
		setHasUnsavedChanges(false);
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open && hasUnsavedChanges) {
					if (confirm(t("common.unsavedChanges"))) {
						setIsOpen(false);
						resetForm();
					}
				} else {
					setIsOpen(open);
					if (!open) {
						resetForm();
					}
				}
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Palette className="h-4 w-4 mr-2" />
					{t("common.manage")} {t("pr.tags")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{t("common.manage")} {t("pr.tags")}
					</DialogTitle>
					<DialogDescription>{t("tags.manageDescription")}</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Add/Edit Tag Form */}
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">
								{editingTag ? t("tags.editTag") : t("tags.addNewTag")}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="tagName">{t("tags.tagName")}</Label>
									<Input
										id="tagName"
										value={editingTag ? editingTag.name : newTagName}
										onChange={(e) => {
											if (editingTag) {
												setEditingTag({ ...editingTag, name: e.target.value });
											} else {
												setNewTagName(e.target.value);
											}
										}}
										placeholder={t("tags.tagPlaceholder")}
									/>
								</div>
								<div>
									<Label htmlFor="tagColor">{t("common.color")}</Label>
									<div className="flex items-center gap-2">
										<Select
											value={editingTag ? editingTag.color : newTagColor}
											onValueChange={(value) => {
												if (editingTag) {
													setEditingTag({ ...editingTag, color: value });
												} else {
													setNewTagColor(value);
												}
											}}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{DEFAULT_COLORS.map((color) => (
													<SelectItem key={color} value={color}>
														<div className="flex items-center gap-2">
															<div
																className="w-4 h-4 rounded-full"
																style={{ backgroundColor: color }}
															/>
															{color}
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<div
											className="w-8 h-8 rounded-full border"
											style={{
												backgroundColor: editingTag
													? editingTag.color
													: newTagColor,
											}}
										/>
									</div>
								</div>
							</div>
							<div>
								<Label htmlFor="tagDescription">
									{t("tags.description")} ({t("common.optional")})
								</Label>
								<Textarea
									id="tagDescription"
									value={
										editingTag
											? editingTag.description || ""
											: newTagDescription
									}
									onChange={(e) => {
										if (editingTag) {
											setEditingTag({
												...editingTag,
												description: e.target.value,
											});
										} else {
											setNewTagDescription(e.target.value);
										}
									}}
									placeholder={t("tags.descriptionPlaceholder")}
									rows={2}
								/>
							</div>
							<div className="flex gap-2">
								<Button
									onClick={editingTag ? handleUpdateTag : handleAddTag}
									disabled={loading}
								>
									{editingTag ? t("tags.updateTag") : t("tags.addTag")}
								</Button>
								{editingTag && (
									<Button variant="outline" onClick={() => setEditingTag(null)}>
										{t("common.cancel")}
									</Button>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Existing Tags */}
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">
								{t("tags.existingTags")}
							</CardTitle>
							<CardDescription>
								{t("tags.manageExistingDescription")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{tags.length === 0 ? (
								<p className="text-muted-foreground text-center py-4">
									{t("tags.noTagsCreated")}
								</p>
							) : (
								<div className="space-y-4">
									{tags.map((tag: Doc<"tags">) => (
										<div key={tag._id} className="border rounded-lg p-4">
											<div className="flex items-center justify-between mb-3">
												<div className="flex items-center gap-2">
													<div
														className="w-4 h-4 rounded-full"
														style={{ backgroundColor: tag.color }}
													/>
													<span className="font-medium">{tag.name}</span>
													{tag.description && (
														<span className="text-sm text-muted-foreground">
															- {tag.description}
														</span>
													)}
												</div>
												<div className="flex gap-2">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setEditingTag(tag)}
													>
														<Edit2 className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleRemoveTag(tag._id)}
													>
														<X className="h-4 w-4" />
													</Button>
												</div>
											</div>

											{/* Reviewer assignments */}
											<div className="grid grid-cols-2 gap-2">
												{reviewers.map((reviewer) => {
													const isAssigned = getReviewerTagState(
														reviewer._id,
														tag._id,
													);
													return (
														<div
															key={reviewer._id}
															className="flex items-center space-x-2"
														>
															<Checkbox
																id={`${tag._id}-${reviewer._id}`}
																checked={isAssigned}
																onCheckedChange={() =>
																	handleToggleReviewerTag(
																		reviewer._id,
																		tag._id,
																		isAssigned,
																	)
																}
																disabled={loading}
															/>
															<Label
																htmlFor={`${tag._id}-${reviewer._id}`}
																className={`text-sm ${reviewer.isAbsent ? "opacity-60" : ""}`}
															>
																{reviewer.name}
																{reviewer.isAbsent && (
																	<span className="text-xs text-muted-foreground ml-1">
																		{t("tags.absent")}
																	</span>
																)}
															</Label>
														</div>
													);
												})}
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				<DialogFooter>
					<div className="flex justify-between w-full">
						<div className="flex gap-2">
							{hasUnsavedChanges && (
								<Button
									onClick={handleSaveChanges}
									disabled={loading}
									className="bg-blue-600 hover:bg-blue-700"
								>
									<Save className="h-4 w-4 mr-2" />
									{t("tags.saveChanges")}
								</Button>
							)}
						</div>
						<Button
							variant="outline"
							onClick={() => {
								if (hasUnsavedChanges) {
									if (confirm(t("common.unsavedChanges"))) {
										setIsOpen(false);
										resetForm();
									}
								} else {
									setIsOpen(false);
								}
							}}
						>
							{t("common.close")}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
