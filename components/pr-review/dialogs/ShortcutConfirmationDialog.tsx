"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export type ShortcutAction = "assign" | "skip" | "undo";

interface ShortcutConfirmationDialogProps {
	isOpen: boolean;
	action: ShortcutAction | null;
	onConfirm: (action: ShortcutAction) => void;
	onCancel: () => void;
	onOpenChange: (open: boolean) => void;
	// Contextual data for dynamic messaging
	nextReviewerName?: string | null;
	currentReviewerName?: string | null; // for skip
	nextAfterSkipName?: string | null; // optional pre-calculated if available
	lastAssignmentFrom?: string | null;
	lastAssignmentTo?: string | null;
}

export function ShortcutConfirmationDialog({
	isOpen,
	action,
	onConfirm,
	onCancel,
	onOpenChange,
	nextReviewerName,
	currentReviewerName,
	nextAfterSkipName,
	lastAssignmentFrom,
	lastAssignmentTo,
}: ShortcutConfirmationDialogProps) {
	const t = useTranslations();

	const base: Record<ShortcutAction, string> = {
		assign: t("shortcutConfirm.assignDescription"),
		skip: t("shortcutConfirm.skipDescription"),
		undo: t("shortcutConfirm.undoDescription"),
	};

	const detailed = useMemo(() => {
		if (!action) return "";
		switch (action) {
			case "assign":
				return nextReviewerName
					? t("shortcutConfirm.assignDetail", {
							nextReviewer: nextReviewerName,
						})
					: "";
			case "skip":
				if (currentReviewerName && nextAfterSkipName) {
					return t("shortcutConfirm.skipDetail", {
						currentReviewer: currentReviewerName,
						nextAfterSkip: nextAfterSkipName,
					});
				}
				return "";
			case "undo":
				if (lastAssignmentFrom && lastAssignmentTo) {
					return t("shortcutConfirm.undoDetail", {
						lastAssignedFrom: lastAssignmentFrom,
						lastAssignedTo: lastAssignmentTo,
					});
				}
				return "";
			// no refresh action anymore
		}
	}, [
		action,
		nextReviewerName,
		currentReviewerName,
		nextAfterSkipName,
		lastAssignmentFrom,
		lastAssignmentTo,
		t,
	]);

	const actionLabels: Record<ShortcutAction, string> = {
		assign: t("shortcutConfirm.actionAssign"),
		skip: t("shortcutConfirm.actionSkip"),
		undo: t("shortcutConfirm.actionUndo"),
	};

	const handleKey = useCallback(
		(e: KeyboardEvent) => {
			if (!isOpen || !action) return;
			const key = e.key.toLowerCase();
			if (key === "y" || key === "enter") {
				e.preventDefault();
				onConfirm(action);
			} else if (key === "n" || key === "escape") {
				e.preventDefault();
				onCancel();
			}
		},
		[isOpen, action, onConfirm, onCancel],
	);

	useEffect(() => {
		if (isOpen) {
			window.addEventListener("keydown", handleKey);
			return () => window.removeEventListener("keydown", handleKey);
		}
	}, [isOpen, handleKey]);

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("shortcutConfirm.title")}</DialogTitle>
					{action && (
						<DialogDescription>
							{base[action]} {detailed ? <span>{detailed} </span> : null}
							{t("shortcutConfirm.confirmHint")}
						</DialogDescription>
					)}
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						{t("common.cancel")}
					</Button>
					{action && (
						<Button onClick={() => onConfirm(action)}>
							{actionLabels[action]}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
