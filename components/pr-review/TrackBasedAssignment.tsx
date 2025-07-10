"use client";

import { Tag, Users } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
	getTags,
	assignPRByTag,
	findNextReviewerByTag,
	type Tag as TagType,
	type Reviewer,
} from "@/app/[locale]/actions";
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
	const t = useTranslations();
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
				title: t("common.error"),
				description: t("messages.loadTagsFailed"),
				variant: "destructive",
			});
		}
	}, [t]);

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
					title: t("common.success"),
					description: t("messages.trackAssignSuccess", {
						reviewer: result.reviewer.name,
						tag: selectedTag?.name || "",
					}),
				});

				// Refresh tags after assignment
				await loadTags();

				// Close dialog and reset state
				setIsOpen(false);
				setSelectedTagId("");
				setNextReviewer(null);
			} else {
				toast({
					title: t("common.error"),
					description: t("messages.trackAssignFailed"),
					variant: "destructive",
				});
			}
		} catch (error) {
			console.error("Error assigning PR:", error);
			toast({
				title: t("common.error"),
				description: t("messages.trackAssignFailed"),
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
					{t("tags.assignBasedOnTags")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{t("tags.tagBasedAssignment")}</DialogTitle>
					<DialogDescription>{t("tags.tagBasedDescription")}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<label
							htmlFor="tag-select"
							className="block text-sm font-medium mb-2"
						>
							{t("tags.selectTag")}
						</label>
						<Select value={selectedTagId} onValueChange={setSelectedTagId}>
							<SelectTrigger>
								<SelectValue placeholder={t("tags.chooseTag")} />
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
									{tags.find((t) => t.id === selectedTagId)?.name}{" "}
									{t("tags.tagLabel")}
								</CardTitle>
								<CardDescription>
									{tags.find((t) => t.id === selectedTagId)?.description}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="text-center py-4">
										<p className="text-sm text-muted-foreground">
											{t("tags.findingNextReviewer")}
										</p>
									</div>
								) : nextReviewer ? (
									<div className="space-y-4">
										<div className="text-center">
											<div className="text-sm font-medium text-muted-foreground mb-1">
												{t("tags.nextReviewer")}
											</div>
											<div className="text-2xl font-bold text-primary">
												{nextReviewer.name}
											</div>
											<div className="text-sm text-muted-foreground">
												{nextReviewer.assignmentCount} {t("tags.assignments")}
											</div>
										</div>

										<div className="border-t pt-4">
											<div className="flex items-center justify-between text-sm">
												<span className="text-muted-foreground">
													{t("tags.availableReviewers")}
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
											{t("tags.noAvailableReviewers")}
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{selectedTagId && (
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">
									{t("tags.availableReviewers")}
								</CardTitle>
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
													<Badge className="ml-2 bg-green-500">
														{t("tags.next")}
													</Badge>
												)}
											</span>
											<span className="text-sm text-muted-foreground">
												{reviewer.assignmentCount} {t("tags.assignments")}
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
						{t("common.cancel")}
					</Button>
					<Button
						onClick={handleAssignPR}
						disabled={!selectedTagId || !nextReviewer || isAssigning}
					>
						{isAssigning ? t("tags.assigning") : t("pr.assignPR")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
