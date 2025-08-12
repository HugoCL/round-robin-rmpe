"use client";

import { Trash2, UserMinus } from "lucide-react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Doc, Id } from "@/convex/_generated/dataModel";

interface DeleteReviewerDialogProps {
	reviewers: Doc<"reviewers">[];
	onDeleteReviewer: (id: Id<"reviewers">) => Promise<void>;
	trigger?: React.ReactNode;
}

export function DeleteReviewerDialog({
	reviewers,
	onDeleteReviewer,
	trigger,
}: DeleteReviewerDialogProps) {
	const t = useTranslations();
	const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
	const [isOpen, setIsOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const selectedReviewer = reviewers.find((r) => r._id === selectedReviewerId);

	const handleDeleteReviewer = async () => {
		if (!selectedReviewerId) return;

		setIsDeleting(true);
		try {
			await onDeleteReviewer(selectedReviewerId as Id<"reviewers">);
			setSelectedReviewerId("");
			setIsOpen(false);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="outline" size="sm">
						<UserMinus className="h-4 w-4 mr-2" />
						{t("pr.deleteReviewer")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("reviewer.deleteTitle")}</DialogTitle>
					<DialogDescription>
						{selectedReviewer
							? t("reviewer.deleteDescription", { name: selectedReviewer.name })
							: t("reviewer.deleteDescription", {
									name: "the selected reviewer",
								})}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="space-y-2">
						<label htmlFor="reviewer-select" className="text-sm font-medium">
							{t("reviewer.selectReviewer")}
						</label>
						<Select
							value={selectedReviewerId}
							onValueChange={setSelectedReviewerId}
						>
							<SelectTrigger>
								<SelectValue placeholder={t("reviewer.selectReviewer")} />
							</SelectTrigger>
							<SelectContent>
								{reviewers.map((reviewer) => (
									<SelectItem key={reviewer._id} value={reviewer._id}>
										<div className="flex items-center justify-between w-full">
											<div className="flex items-center gap-2">
												<span>{reviewer.name}</span>
												{reviewer.isAbsent && (
													<Badge variant="secondary" className="text-xs">
														{t("tags.absent")}
													</Badge>
												)}
											</div>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setIsOpen(false)}
						disabled={isDeleting}
					>
						{t("common.cancel")}
					</Button>
					<Button
						variant="destructive"
						onClick={handleDeleteReviewer}
						disabled={!selectedReviewerId || isDeleting}
					>
						{isDeleting ? (
							t("common.removing")
						) : (
							<>
								<Trash2 className="h-4 w-4 mr-2" />
								{t("pr.deleteReviewer")}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
