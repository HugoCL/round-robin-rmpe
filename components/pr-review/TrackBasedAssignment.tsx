"use client";

import { Tag, Users } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import {
	getTags,
	assignPRByTag,
	findNextReviewerByTag,
	type Tag as TagType,
	type Reviewer,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface TrackBasedAssignmentProps {
	reviewers: Reviewer[];
	onDataUpdate: () => Promise<void>;
	user?: { email: string; name?: string } | null;
}

export function TrackBasedAssignment({
	reviewers,
	onDataUpdate,
	user,
}: TrackBasedAssignmentProps) {
	const [tags, setTags] = useState<TagType[]>([]);
	const [selectedTagId, setSelectedTagId] = useState<string>("");
	const [nextReviewer, setNextReviewer] = useState<Reviewer | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [isAssigning, setIsAssigning] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

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

	const findNextReviewerForTag = useCallback(async (tagId: string) => {
		setIsLoading(true);
		try {
			const result = await findNextReviewerByTag(tagId);
			if (result.success && result.nextReviewer) {
				setNextReviewer(result.nextReviewer);
			} else {
				setNextReviewer(null);
			}
		} catch (error) {
			console.error("Error finding next reviewer:", error);
			setNextReviewer(null);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			loadTags();
		}
	}, [isOpen, loadTags]);

	// Refresh tags when reviewers change (e.g., when tags are added/removed)
	useEffect(() => {
		if (isOpen) {
			loadTags();
		}
	}, [reviewers, loadTags, isOpen]);

	useEffect(() => {
		if (selectedTagId) {
			findNextReviewerForTag(selectedTagId);
		} else {
			setNextReviewer(null);
		}
	}, [selectedTagId, findNextReviewerForTag]);

	const handleAssignPR = async () => {
		if (!selectedTagId || !nextReviewer) return;

		setIsAssigning(true);
		try {
			const result = await assignPRByTag(selectedTagId, user || undefined);

			if (result.success && result.reviewer) {
				// Update the parent component's data first
				await onDataUpdate();

				const selectedTag = tags.find((t) => t.id === selectedTagId);
				toast({
					title: "PR Assigned",
					description: `PR assigned to ${result.reviewer.name} (${selectedTag?.name} tag)`,
				});

				// Refresh tags after assignment
				await loadTags();

				// Close dialog and reset state
				setIsOpen(false);
				setSelectedTagId("");
				setNextReviewer(null);
			} else {
				toast({
					title: "Error",
					description: "Failed to assign PR. Please try again.",
					variant: "destructive",
				});
			}
		} catch (error) {
			console.error("Error assigning PR:", error);
			toast({
				title: "Error",
				description: "Failed to assign PR. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsAssigning(false);
		}
	};

	const getReviewersForTag = (tagId: string) => {
		return reviewers.filter((r) => r.tags?.includes(tagId) && !r.isAbsent);
	};

	const getTagStats = (tagId: string) => {
		const tagReviewers = getReviewersForTag(tagId);
		const totalReviewers = tagReviewers.length;
		const availableReviewers = tagReviewers.filter((r) => !r.isAbsent).length;

		return { totalReviewers, availableReviewers };
	};

	const resetAndClose = () => {
		setSelectedTagId("");
		setNextReviewer(null);
		setIsOpen(false);
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) {
					resetAndClose();
				} else {
					setIsOpen(open);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" className="w-full">
					<Tag className="h-4 w-4 mr-2" />
					Assign Based on Tags
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Tag-Based Assignment</DialogTitle>
					<DialogDescription>
						Select a tag to assign the PR to the next reviewer in that specific
						area.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<label
							htmlFor="tag-select"
							className="block text-sm font-medium mb-2"
						>
							Select Tag
						</label>
						<Select value={selectedTagId} onValueChange={setSelectedTagId}>
							<SelectTrigger>
								<SelectValue placeholder="Choose a tag..." />
							</SelectTrigger>
							<SelectContent>
								{tags.map((tag) => {
									const stats = getTagStats(tag.id);
									return (
										<SelectItem key={tag.id} value={tag.id}>
											<div className="flex items-center gap-2">
												<div
													className="w-3 h-3 rounded-full"
													style={{ backgroundColor: tag.color }}
												/>
												<span>{tag.name}</span>
												<Badge variant="secondary" className="ml-auto">
													{stats.availableReviewers}/{stats.totalReviewers}
												</Badge>
											</div>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</div>

					{selectedTagId && (
						<Card>
							<CardHeader>
								<CardTitle className="text-lg flex items-center gap-2">
									<div
										className="w-4 h-4 rounded-full"
										style={{
											backgroundColor: tags.find((t) => t.id === selectedTagId)
												?.color,
										}}
									/>
									{tags.find((t) => t.id === selectedTagId)?.name} Tag
								</CardTitle>
								<CardDescription>
									{tags.find((t) => t.id === selectedTagId)?.description}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="text-center py-4">
										<p className="text-sm text-muted-foreground">
											Finding next reviewer...
										</p>
									</div>
								) : nextReviewer ? (
									<div className="space-y-4">
										<div className="text-center">
											<div className="text-sm font-medium text-muted-foreground mb-1">
												Next Reviewer
											</div>
											<div className="text-2xl font-bold text-primary">
												{nextReviewer.name}
											</div>
											<div className="text-sm text-muted-foreground">
												{nextReviewer.assignmentCount} assignments
											</div>
										</div>

										<div className="border-t pt-4">
											<div className="flex items-center justify-between text-sm">
												<span className="text-muted-foreground">
													Available reviewers:
												</span>
												<div className="flex items-center gap-1">
													<Users className="h-4 w-4" />
													<span>
														{getTagStats(selectedTagId).availableReviewers}
													</span>
												</div>
											</div>
										</div>
									</div>
								) : (
									<div className="text-center py-4">
										<p className="text-sm text-muted-foreground">
											No available reviewers for this tag
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{selectedTagId && (
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Available Reviewers</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{getReviewersForTag(selectedTagId).map((reviewer) => (
										<div
											key={reviewer.id}
											className="flex items-center justify-between"
										>
											<span className="text-sm">
												{reviewer.name}
												{reviewer.id === nextReviewer?.id && (
													<Badge className="ml-2 bg-green-500">Next</Badge>
												)}
											</span>
											<span className="text-sm text-muted-foreground">
												{reviewer.assignmentCount} assignments
											</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={resetAndClose}>
						Cancel
					</Button>
					<Button
						onClick={handleAssignPR}
						disabled={!selectedTagId || !nextReviewer || isAssigning}
					>
						{isAssigning ? "Assigning..." : "Assign PR"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
