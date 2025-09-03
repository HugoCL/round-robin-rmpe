"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePRReview } from "../PRReviewContext";

interface SkipConfirmationDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	nextAfterSkip: Doc<"reviewers"> | null;
	onConfirm: () => void;
	onCancel: () => void;
}

export function SkipConfirmationDialog({
	isOpen,
	onOpenChange,
	nextAfterSkip,
	onConfirm,
	onCancel,
}: SkipConfirmationDialogProps) {
	const t = useTranslations();
	const { nextReviewer } = usePRReview();

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>
						{t("pr.skip")} {t("common.confirm")}
					</DialogTitle>
					<DialogDescription>
						{nextReviewer
							? t("reviewer.skipDescription", { name: nextReviewer.name })
							: t("reviewer.skipDescription", { name: "the current reviewer" })}
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					{nextReviewer && nextAfterSkip && (
						<p className="text-center">
							{t("skipConfirmation.message", {
								nextReviewer: nextReviewer.name,
								nextAfterSkip: nextAfterSkip.name,
							})}
						</p>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						{t("common.cancel")}
					</Button>
					<Button onClick={onConfirm}>{t("common.confirm")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
