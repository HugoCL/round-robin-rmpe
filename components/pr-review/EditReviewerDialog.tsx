"use client";

import { Edit } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Reviewer } from "@/app/[locale]/actions";
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

interface EditReviewerDialogProps {
	reviewer: Reviewer;
	onUpdateReviewer: (id: string, name: string, email: string) => Promise<boolean>;
	trigger?: React.ReactNode;
}

export function EditReviewerDialog({
	reviewer,
	onUpdateReviewer,
	trigger,
}: EditReviewerDialogProps) {
	const t = useTranslations();
	const [reviewerName, setReviewerName] = useState(reviewer.name);
	const [reviewerEmail, setReviewerEmail] = useState(reviewer.email);
	const [isOpen, setIsOpen] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	const handleUpdateReviewer = async () => {
		if (!reviewerName.trim() || !reviewerEmail.trim()) return;

		setIsUpdating(true);
		try {
			const success = await onUpdateReviewer(
				reviewer.id,
				reviewerName.trim(),
				reviewerEmail.trim(),
			);
			if (success) {
				setIsOpen(false);
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
		if (open) {
			// Reset form when opening
			setReviewerName(reviewer.name);
			setReviewerEmail(reviewer.email);
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
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("reviewer.editReviewer")}</DialogTitle>
					<DialogDescription>{t("reviewer.editDescription")}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="edit-reviewer-name" className="text-right">
							{t("common.name")}
						</Label>
						<Input
							id="edit-reviewer-name"
							placeholder={t("reviewer.enterName")}
							value={reviewerName}
							onChange={(e) => setReviewerName(e.target.value)}
							onKeyDown={handleKeyDown}
							className="col-span-3"
							autoFocus
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="edit-reviewer-email" className="text-right">
							{t("common.email")}
						</Label>
						<Input
							id="edit-reviewer-email"
							type="email"
							placeholder={t("reviewer.enterEmail")}
							value={reviewerEmail}
							onChange={(e) => setReviewerEmail(e.target.value)}
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