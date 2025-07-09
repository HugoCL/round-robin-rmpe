"use client";

import { X, Edit2, Palette, Save } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import {
	getTags,
	addTag,
	updateTag,
	removeTag,
	assignTagToReviewer,
	removeTagFromReviewer,
	type Tag,
	type Reviewer,
} from "@/app/actions";
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
import { toast } from "@/hooks/use-toast";
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

interface TagManagerProps {
	reviewers: Reviewer[];
	onDataUpdate: () => Promise<void>;
}

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

export function TagManager({ reviewers, onDataUpdate }: TagManagerProps) {
	const [tags, setTags] = useState<Tag[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [editingTag, setEditingTag] = useState<Tag | null>(null);
	const [newTagName, setNewTagName] = useState("");
	const [newTagColor, setNewTagColor] = useState(DEFAULT_COLORS[0]);
	const [newTagDescription, setNewTagDescription] = useState("");
	const [loading, setLoading] = useState(false);
	const [pendingChanges, setPendingChanges] = useState<{
		[reviewerId: string]: { [tagId: string]: boolean };
	}>({});
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	const loadTags = useCallback(async () => {
		try {
			const tagsData = await getTags();
			setTags(tagsData);
		} catch (error) {
			console.error("Error loading tags:", error);
			toast({
				title: "Error",
				description: "Failed to load tags",
				variant: "destructive",
			});
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			loadTags();
		}
	}, [isOpen, loadTags]);

	const handleAddTag = async () => {
		if (!newTagName.trim()) {
			toast({
				title: "Error",
				description: "Please enter a tag name",
				variant: "destructive",
			});
			return;
		}

		setLoading(true);
		try {
			const success = await addTag(newTagName, newTagColor, newTagDescription);
			if (success) {
				setNewTagName("");
				setNewTagDescription("");
				setNewTagColor(DEFAULT_COLORS[0]);
				await Promise.all([loadTags(), onDataUpdate()]);
				toast({
					title: "Success",
					description: "Tag added successfully",
				});
			} else {
				toast({
					title: "Error",
					description: "Failed to add tag",
					variant: "destructive",
				});
			}
		} catch (_error) {
			console.error("Error adding tag:", _error);
			toast({
				title: "Error",
				description: "Failed to add tag",
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
			const success = await updateTag(editingTag);
			if (success) {
				setEditingTag(null);
				await loadTags();
				toast({
					title: "Success",
					description: "Tag updated successfully",
				});
			} else {
				toast({
					title: "Error",
					description: "Failed to update tag",
					variant: "destructive",
				});
			}
		} catch (_error) {
			toast({
				title: "Error",
				description: "Failed to update tag",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleRemoveTag = async (tagId: string) => {
		if (
			!confirm(
				"Are you sure you want to remove this tag? It will be removed from all reviewers.",
			)
		) {
			return;
		}

		setLoading(true);
		try {
			const success = await removeTag(tagId);
			if (success) {
				await loadTags();
				await onDataUpdate(); // Refresh reviewers data
				toast({
					title: "Success",
					description: "Tag removed successfully",
				});
			} else {
				toast({
					title: "Error",
					description: "Failed to remove tag",
					variant: "destructive",
				});
			}
		} catch (_error) {
			toast({
				title: "Error",
				description: "Failed to remove tag",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleToggleReviewerTag = (
		reviewerId: string,
		tagId: string,
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
					const currentlyAssigned =
						reviewers.find((r) => r.id === reviewerId)?.tags?.includes(tagId) ||
						false;

					// Only make changes if the state is different from current
					if (shouldAssign !== currentlyAssigned) {
						if (shouldAssign) {
							promises.push(assignTagToReviewer(reviewerId, tagId));
						} else {
							promises.push(removeTagFromReviewer(reviewerId, tagId));
						}
					}
				}
			}

			if (promises.length > 0) {
				const results = await Promise.all(promises);
				const allSuccessful = results.every((result) => result);

				if (allSuccessful) {
					setPendingChanges({});
					setHasUnsavedChanges(false);
					await onDataUpdate(); // Refresh reviewers data
					toast({
						title: "Success",
						description: "Tag assignments saved successfully",
					});
				} else {
					toast({
						title: "Error",
						description: "Some changes failed to save",
						variant: "destructive",
					});
				}
			}
		} catch (_error) {
			toast({
				title: "Error",
				description: "Failed to save changes",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const getReviewerTagState = (reviewerId: string, tagId: string) => {
		// Check if there's a pending change for this reviewer/tag combination
		if (
			pendingChanges[reviewerId] &&
			pendingChanges[reviewerId][tagId] !== undefined
		) {
			return pendingChanges[reviewerId][tagId];
		}
		// Otherwise, return the current state
		return (
			reviewers.find((r) => r.id === reviewerId)?.tags?.includes(tagId) || false
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
					if (
						confirm(
							"You have unsaved changes. Are you sure you want to close without saving?",
						)
					) {
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
					Manage Tags
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Manage Tags</DialogTitle>
					<DialogDescription>
						Create and manage tags for tag-based PR assignments.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Add/Edit Tag Form */}
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">
								{editingTag ? "Edit Tag" : "Add New Tag"}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="tagName">Tag Name</Label>
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
										placeholder="e.g., Frontend, Backend"
									/>
								</div>
								<div>
									<Label htmlFor="tagColor">Color</Label>
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
								<Label htmlFor="tagDescription">Description (optional)</Label>
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
									placeholder="Describe what this tag represents..."
									rows={2}
								/>
							</div>
							<div className="flex gap-2">
								<Button
									onClick={editingTag ? handleUpdateTag : handleAddTag}
									disabled={loading}
								>
									{editingTag ? "Update Tag" : "Add Tag"}
								</Button>
								{editingTag && (
									<Button variant="outline" onClick={() => setEditingTag(null)}>
										Cancel
									</Button>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Existing Tags */}
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Existing Tags</CardTitle>
							<CardDescription>
								Manage existing tags and assign them to reviewers
							</CardDescription>
						</CardHeader>
						<CardContent>
							{tags.length === 0 ? (
								<p className="text-muted-foreground text-center py-4">
									No tags created yet
								</p>
							) : (
								<div className="space-y-4">
									{tags.map((tag) => (
										<div key={tag.id} className="border rounded-lg p-4">
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
														onClick={() => handleRemoveTag(tag.id)}
													>
														<X className="h-4 w-4" />
													</Button>
												</div>
											</div>

											{/* Reviewer assignments */}
											<div className="grid grid-cols-2 gap-2">
												{reviewers.map((reviewer) => {
													const isAssigned = getReviewerTagState(
														reviewer.id,
														tag.id,
													);
													return (
														<div
															key={reviewer.id}
															className="flex items-center space-x-2"
														>
															<Checkbox
																id={`${tag.id}-${reviewer.id}`}
																checked={isAssigned}
																onCheckedChange={() =>
																	handleToggleReviewerTag(
																		reviewer.id,
																		tag.id,
																		isAssigned,
																	)
																}
																disabled={loading}
															/>
															<Label
																htmlFor={`${tag.id}-${reviewer.id}`}
																className={`text-sm ${reviewer.isAbsent ? "opacity-60" : ""}`}
															>
																{reviewer.name}
																{reviewer.isAbsent && (
																	<span className="text-xs text-muted-foreground ml-1">
																		(absent)
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
									Save Changes
								</Button>
							)}
						</div>
						<Button
							variant="outline"
							onClick={() => {
								if (hasUnsavedChanges) {
									if (
										confirm(
											"You have unsaved changes. Are you sure you want to close without saving?",
										)
									) {
										setIsOpen(false);
										resetForm();
									}
								} else {
									setIsOpen(false);
								}
							}}
						>
							Close
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
