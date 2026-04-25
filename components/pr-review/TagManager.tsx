"use client";

import { Palette, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { usePRReview } from "./PRReviewContext";
import { TagAssignmentsCard } from "./tag-manager/TagAssignmentsCard";
import { TagEditorCard } from "./tag-manager/TagEditorCard";
import { useTagManagerController } from "./tag-manager/useTagManagerController";

export function TagManager() {
	const t = useTranslations();
	const { reviewers, onDataUpdate, teamSlug } = usePRReview();
	const [isOpen, setIsOpen] = useState(false);

	const {
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
	} = useTagManagerController({
		teamSlug,
		reviewers,
		onDataUpdate,
	});

	const handleOpenChange = (open: boolean) => {
		if (!open && hasUnsavedChanges) {
			if (confirm(t("common.unsavedChanges"))) {
				setIsOpen(false);
				resetForm();
			}
			return;
		}
		setIsOpen(open);
		if (!open) {
			resetForm();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
					<TagEditorCard
						isEditing={!!editingTag}
						tagName={editingTag ? editingTag.name : newTagName}
						tagColor={editingTag ? editingTag.color : newTagColor}
						tagDescription={
							editingTag ? (editingTag.description ?? "") : newTagDescription
						}
						loading={loading}
						onTagNameChange={(value) => {
							if (editingTag) {
								setEditingTag({ ...editingTag, name: value });
								return;
							}
							setNewTagName(value);
						}}
						onTagColorChange={(value) => {
							if (editingTag) {
								setEditingTag({ ...editingTag, color: value });
								return;
							}
							setNewTagColor(value);
						}}
						onTagDescriptionChange={(value) => {
							if (editingTag) {
								setEditingTag({ ...editingTag, description: value });
								return;
							}
							setNewTagDescription(value);
						}}
						onSubmit={editingTag ? handleUpdateTag : handleAddTag}
						onCancelEditing={() => setEditingTag(null)}
					/>

					<TagAssignmentsCard
						tags={tags}
						reviewers={reviewers}
						loading={loading}
						getReviewerTagState={getReviewerTagState}
						onToggleReviewerTag={handleToggleReviewerTag}
						onEditTag={setEditingTag}
						onRemoveTag={handleRemoveTag}
					/>
				</div>

				<DialogFooter>
					<div className="flex justify-between w-full">
						<div className="flex gap-2">
							{hasUnsavedChanges && (
								<Button
									onClick={() => void handleSaveChanges()}
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
