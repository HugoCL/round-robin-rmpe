"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { focusPrUrlInput, isTagModeActive } from "@/lib/assignmentFocus";
import { UndoConfirmContent } from "../assignment/UndoConfirmContent";
import type { UndoCopy } from "../assignment/undoCopy";

export type ShortcutAction = "skip" | "undo";

interface ShortcutConfirmationDialogProps {
	isOpen: boolean;
	action: ShortcutAction | null;
	onConfirm: (action: ShortcutAction) => void;
	onCancel: () => void;
	onOpenChange: (open: boolean) => void;
	currentReviewerName?: string | null; // for skip
	/** The one being skipped is the viewer: speak to them, not about them. */
	isSelfNext?: boolean;
	undoCopy: UndoCopy;
}

/**
 * Confirms what S or U started. Focus starts on the confirm button, so Enter
 * confirms and Esc cancels; letters do nothing here.
 */
export function ShortcutConfirmationDialog({
	isOpen,
	action,
	onConfirm,
	onCancel,
	onOpenChange,
	currentReviewerName,
	isSelfNext = false,
	undoCopy,
}: ShortcutConfirmationDialogProps) {
	const t = useTranslations();
	const confirmRef = useRef<HTMLButtonElement>(null);
	const keysHint = (
		<span className="mt-1 block text-xs text-muted-foreground">
			{t("shortcutConfirm.confirmHint")}
		</span>
	);

	if (action === "undo") {
		return (
			<AlertDialog open={isOpen} onOpenChange={onOpenChange}>
				<UndoConfirmContent
					title={undoCopy.title}
					description={
						<>
							{t("history.undoLastConfirmDescription")}
							{undoCopy.chatNote ? ` ${undoCopy.chatNote}` : null}
							{keysHint}
						</>
					}
					onConfirm={() => onConfirm("undo")}
					focusConfirm
				/>
			</AlertDialog>
		);
	}

	// Skipping marks the person who is next as reviewed: name them and say so.
	// S always acts on the general rotation, which tag mode does not show.
	const generalRotation = isTagModeActive();
	const title = isSelfNext
		? t(
				generalRotation
					? "shortcutConfirm.skipSelfTitleGeneral"
					: "shortcutConfirm.skipSelfTitle",
			)
		: currentReviewerName
			? t(
					generalRotation
						? "shortcutConfirm.skipTitleGeneral"
						: "shortcutConfirm.skipTitle",
					{ name: currentReviewerName },
				)
			: t("shortcutConfirm.actionSkip");

	return (
		<AlertDialog open={isOpen} onOpenChange={onOpenChange}>
			<AlertDialogContent
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					confirmRef.current?.focus();
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					focusPrUrlInput();
				}}
			>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>
						{t(
							isSelfNext
								? "shortcutConfirm.skipSelfEffect"
								: "shortcutConfirm.skipEffect",
						)}
						{keysHint}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={onCancel}>
						{t("common.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						ref={confirmRef}
						onClick={() => {
							if (action) onConfirm(action);
						}}
					>
						{t(
							isSelfNext
								? "shortcutConfirm.actionSkipSelf"
								: "shortcutConfirm.actionSkip",
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
