"use client";

import { UserPlus } from "lucide-react";
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

interface AddReviewerDialogProps {
	onAddReviewer: (name: string, email: string) => Promise<boolean>;
	trigger?: React.ReactNode;
}

export function AddReviewerDialog({
	onAddReviewer,
	trigger,
}: AddReviewerDialogProps) {
	const t = useTranslations();
	const [newReviewerName, setNewReviewerName] = useState("");
	const [newReviewerEmail, setNewReviewerEmail] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [isAdding, setIsAdding] = useState(false);

	// unique ids for inputs
	const reviewerNameId = useId();
	const reviewerEmailId = useId();

	const handleAddReviewer = async () => {
		if (!newReviewerName.trim() || !newReviewerEmail.trim()) return;

		setIsAdding(true);
		try {
			const success = await onAddReviewer(
				newReviewerName.trim(),
				newReviewerEmail.trim(),
			);
			if (success) {
				setNewReviewerName("");
				setNewReviewerEmail("");
				setIsOpen(false);
			}
		} finally {
			setIsAdding(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleAddReviewer();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="outline" size="sm">
						<UserPlus className="h-4 w-4 mr-2" />
						{t("pr.addReviewer")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("reviewer.addNew")}</DialogTitle>
					<DialogDescription>{t("reviewer.addDescription")}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor={reviewerNameId} className="text-right">
							{t("common.name")}
						</Label>
						<Input
							id={reviewerNameId}
							placeholder={t("reviewer.enterName")}
							value={newReviewerName}
							onChange={(e) => setNewReviewerName(e.target.value)}
							onKeyDown={handleKeyDown}
							className="col-span-3"
							autoFocus
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor={reviewerEmailId} className="text-right">
							{t("common.email")}
						</Label>
						<Input
							id={reviewerEmailId}
							type="email"
							placeholder={t("reviewer.enterEmail")}
							value={newReviewerEmail}
							onChange={(e) => setNewReviewerEmail(e.target.value)}
							onKeyDown={handleKeyDown}
							className="col-span-3"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setIsOpen(false)}
						disabled={isAdding}
					>
						{t("common.cancel")}
					</Button>
					<Button
						onClick={handleAddReviewer}
						disabled={
							!newReviewerName.trim() || !newReviewerEmail.trim() || isAdding
						}
					>
						{isAdding ? t("common.adding") : t("pr.addReviewer")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
