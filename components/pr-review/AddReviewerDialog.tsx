"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
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
	onAddReviewer: (name: string) => Promise<boolean>;
	trigger?: React.ReactNode;
}

export function AddReviewerDialog({
	onAddReviewer,
	trigger,
}: AddReviewerDialogProps) {
	const t = useTranslations();
	const [newReviewerName, setNewReviewerName] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [isAdding, setIsAdding] = useState(false);

	const handleAddReviewer = async () => {
		if (!newReviewerName.trim()) return;

		setIsAdding(true);
		try {
			const success = await onAddReviewer(newReviewerName.trim());
			if (success) {
				setNewReviewerName("");
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
						<Label htmlFor="reviewer-name" className="text-right">
							{t("common.name")}
						</Label>
						<Input
							id="reviewer-name"
							placeholder={t("reviewer.enterName")}
							value={newReviewerName}
							onChange={(e) => setNewReviewerName(e.target.value)}
							onKeyDown={handleKeyDown}
							className="col-span-3"
							autoFocus
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
						disabled={!newReviewerName.trim() || isAdding}
					>
						{isAdding ? t("common.adding") : t("pr.addReviewer")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
