"use client";

import { Edit } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
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
import type { Doc, Id } from "@/convex/_generated/dataModel";

interface EditReviewerDialogProps {
	reviewer: Doc<"reviewers">;
	onUpdateReviewer: (
		id: Id<"reviewers">,
		name: string,
		email: string,
		googleChatUserId?: string,
	) => Promise<boolean>;
	trigger?: React.ReactNode;
}

export function EditReviewerDialog({
	reviewer,
	onUpdateReviewer,
	trigger,
}: EditReviewerDialogProps) {
	const t = useTranslations();
	const [isOpen, setIsOpen] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	// Track edits only when user modifies a field
	const [edits, setEdits] = useState<{
		name?: string;
		email?: string;
		googleChatUserId?: string;
	}>({});

	// Derive current values from props + local edits
	const reviewerName = edits.name ?? reviewer.name;
	const reviewerEmail = edits.email ?? reviewer.email;
	const googleChatUserId =
		edits.googleChatUserId ?? reviewer.googleChatUserId ?? "";

	// unique ids
	const nameId = useId();
	const emailId = useId();
	const chatId = useId();

	const handleUpdateReviewer = async () => {
		if (!reviewerName.trim() || !reviewerEmail.trim()) return;

		setIsUpdating(true);
		try {
			const success = await onUpdateReviewer(
				reviewer._id,
				reviewerName.trim(),
				reviewerEmail.trim(),
				googleChatUserId.trim() || undefined,
			);
			if (success) {
				setIsOpen(false);
				setEdits({}); // Clear edits on success
			}
		} finally {
			setIsUpdating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleUpdateReviewer();
		}
	};

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setEdits({}); // Clear edits when closing
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="ghost" size="sm">
						<Edit className="h-4 w-4" />
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w[425px]">
				<DialogHeader>
					<DialogTitle>{t("reviewer.editReviewer")}</DialogTitle>
					<DialogDescription>{t("reviewer.editDescription")}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor={nameId} className="text-right">
							{t("common.name")}
						</Label>
						<Input
							id={nameId}
							placeholder={t("reviewer.enterName")}
							value={reviewerName}
							onChange={(e) =>
								setEdits((prev) => ({ ...prev, name: e.target.value }))
							}
							onKeyDown={handleKeyDown}
							className="col-span-3"
							autoFocus
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor={chatId} className="text-right">
							{t("reviewer.googleChatUserIdLabel", { default: "Chat User ID" })}
						</Label>
						<Input
							id={chatId}
							placeholder={t("reviewer.googleChatUserIdPlaceholder", {
								default: "Optional Google Chat user ID",
							})}
							value={googleChatUserId}
							onChange={(e) =>
								setEdits((prev) => ({
									...prev,
									googleChatUserId: e.target.value,
								}))
							}
							onKeyDown={handleKeyDown}
							className="col-span-3"
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor={emailId} className="text-right">
							{t("common.email")}
						</Label>
						<Input
							id={emailId}
							type="email"
							placeholder={t("reviewer.enterEmail")}
							value={reviewerEmail}
							onChange={(e) =>
								setEdits((prev) => ({ ...prev, email: e.target.value }))
							}
							onKeyDown={handleKeyDown}
							className="col-span-3"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setIsOpen(false)}
						disabled={isUpdating}
					>
						{t("common.cancel")}
					</Button>
					<Button
						onClick={handleUpdateReviewer}
						disabled={
							!reviewerName.trim() || !reviewerEmail.trim() || isUpdating
						}
					>
						{isUpdating ? t("common.updating") : t("common.update")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
