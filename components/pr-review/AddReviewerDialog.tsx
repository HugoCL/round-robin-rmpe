"use client";

import { UserPlus } from "lucide-react";
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
						Add Reviewer
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Add New Reviewer</DialogTitle>
					<DialogDescription>
						Enter the name of the new reviewer to add to the rotation.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="reviewer-name" className="text-right">
							Name
						</Label>
						<Input
							id="reviewer-name"
							placeholder="Enter reviewer name"
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
						Cancel
					</Button>
					<Button
						onClick={handleAddReviewer}
						disabled={!newReviewerName.trim() || isAdding}
					>
						{isAdding ? "Adding..." : "Add Reviewer"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
