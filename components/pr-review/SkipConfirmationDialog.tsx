"use client";

import type { Reviewer } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface SkipConfirmationDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	nextReviewer: Reviewer | null;
	nextAfterSkip: Reviewer | null;
	onConfirm: () => void;
	onCancel: () => void;
}

export function SkipConfirmationDialog({
	isOpen,
	onOpenChange,
	nextReviewer,
	nextAfterSkip,
	onConfirm,
	onCancel,
}: SkipConfirmationDialogProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Confirm Skip</DialogTitle>
					<DialogDescription>
						You're about to skip yourself in the PR review rotation.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					{nextReviewer && nextAfterSkip && (
						<p className="text-center">
							Hey <span className="font-bold">{nextReviewer.name}</span>! You'll
							be skipped and you'll assign this PR to{" "}
							<span className="font-bold">{nextAfterSkip.name}</span>. Do you
							confirm?
						</p>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button onClick={onConfirm}>Confirm</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
