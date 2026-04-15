"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import type { Reviewer } from "@/lib/types";

export const DEFAULT_COLORS = [
	"#3B82F6",
	"#10B981",
	"#F59E0B",
	"#8B5CF6",
	"#EF4444",
	"#06B6D4",
	"#84CC16",
	"#F97316",
	"#EC4899",
	"#6B7280",
] as const;

type UseTagManagerControllerInput = {
	teamSlug?: string;
	reviewers: Reviewer[];
	onDataUpdate?: () => Promise<void> | void;
};

export function useTagManagerController({
	teamSlug,
	reviewers,
	onDataUpdate,
}: UseTagManagerControllerInput) {
	const t = useTranslations();

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

	const [editingTag, setEditingTag] = useState<Doc<"tags"> | null>(null);
	const [newTagName, setNewTagName] = useState("");
	const [newTagColor, setNewTagColor] = useState<string>(DEFAULT_COLORS[0]);
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
			await onDataUpdate?.();
			toast({
				title: t("common.success"),
				description: t("messages.tagAdded"),
			});
		} catch (error) {
			console.error("Error adding tag:", error);
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
			await onDataUpdate?.();
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
			const promises = [] as Promise<unknown>[];

			for (const [reviewerId, tagChanges] of Object.entries(pendingChanges)) {
				for (const [tagId, shouldAssign] of Object.entries(tagChanges)) {
					const reviewerIdTyped = reviewerId as Id<"reviewers">;
					const tagIdTyped = tagId as Id<"tags">;

					const currentlyAssigned =
						reviewers
							.find((reviewer) => reviewer._id === reviewerIdTyped)
							?.tags?.includes(tagIdTyped) || false;

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
				await onDataUpdate?.();
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
		if (
			pendingChanges[reviewerId] &&
			pendingChanges[reviewerId][tagId] !== undefined
		) {
			return pendingChanges[reviewerId][tagId];
		}
		return (
			reviewers
				.find((reviewer) => reviewer._id === reviewerId)
				?.tags?.includes(tagId) || false
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

	return {
		tags,
		editingTag,
		setEditingTag,
		newTagName,
		setNewTagName,
		newTagColor,
		setNewTagColor,
		newTagDescription,
		setNewTagDescription,
		loading,
		hasUnsavedChanges,
		handleAddTag,
		handleUpdateTag,
		handleRemoveTag,
		handleToggleReviewerTag,
		handleSaveChanges,
		getReviewerTagState,
		resetForm,
	};
}
