"use client";

import { Trash2, UserMinus } from "lucide-react";
import { useState } from "react";
import type { Reviewer } from "@/app/actions";
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

interface DeleteReviewerDialogProps {
	reviewers: Reviewer[];
	onDeleteReviewer: (id: string) => Promise<void>;
	trigger?: React.ReactNode;
}

export function DeleteReviewerDialog({
	reviewers,
	onDeleteReviewer,
	trigger,
}: DeleteReviewerDialogProps) {
	const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
	const [isOpen, setIsOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const selectedReviewer = reviewers.find((r) => r.id === selectedReviewerId);

	const handleDeleteReviewer = async () => {
		if (!selectedReviewerId) return;

		setIsDeleting(true);
		try {
			await onDeleteReviewer(selectedReviewerId);
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
						Delete Reviewer
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Delete Reviewer</DialogTitle>
					<DialogDescription>
						Select a reviewer to remove from the rotation. This action cannot be
						undone.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="space-y-2">
						<label htmlFor="reviewer-select" className="text-sm font-medium">
							Select Reviewer to Delete
						</label>
						<Select
							value={selectedReviewerId}
							onValueChange={setSelectedReviewerId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Choose a reviewer to delete..." />
							</SelectTrigger>
							<SelectContent>
								{reviewers.map((reviewer) => (
									<SelectItem key={reviewer.id} value={reviewer.id}>
										<div className="flex items-center justify-between w-full">
											<div className="flex items-center gap-2">
												<span>{reviewer.name}</span>
												{reviewer.isAbsent && (
													<Badge variant="secondary" className="text-xs">
														Absent
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
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleDeleteReviewer}
						disabled={!selectedReviewerId || isDeleting}
					>
						{isDeleting ? (
							"Deleting..."
						) : (
							<>
								<Trash2 className="h-4 w-4 mr-2" />
								Delete Reviewer
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
