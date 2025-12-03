"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ChatMessageCustomizer } from "../ChatMessageCustomizer";

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

	// Unified chat message customization state
	const [sendMessage, setSendMessage] = useState(false);
	const [enableCustomMessage, setEnableCustomMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [customMessage, setCustomMessage] = useState("");

	// Expose chosen message via CustomEvent so parent can pick it up without prop drilling changes
	useEffect(() => {
		if (!isOpen) return;
		const detail = {
			shouldSend: sendMessage,
			customEnabled: enableCustomMessage,
			prUrl: prUrl.trim() || undefined,
			message:
				enableCustomMessage && customMessage.trim().length > 0
					? customMessage
					: undefined,
		};
		window.dispatchEvent(
			new CustomEvent("shortcutDialogMessageState", { detail }),
		);
	}, [sendMessage, enableCustomMessage, prUrl, customMessage, isOpen]);

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
			<DialogContent className="sm:max-w-[460px]">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
							<span className="text-sm font-semibold">⌘</span>
						</span>
						<DialogTitle>{t("shortcutConfirm.title")}</DialogTitle>
					</div>
					{action && (
						<DialogDescription>
							{base[action]} {detailed ? <span>{detailed} </span> : null}
							{t("shortcutConfirm.confirmHint")}
							<span className="block text-[11px] text-muted-foreground mt-1">
								Enter / Y to confirm · Esc / N to cancel
							</span>
						</DialogDescription>
					)}
				</DialogHeader>
				{action && (action === "assign" || action === "skip") && (
					<ChatMessageCustomizer
						prUrl={prUrl}
						onPrUrlChange={setPrUrl}
						contextUrl={contextUrl}
						onContextUrlChange={setContextUrl}
						sendMessage={sendMessage}
						onSendMessageChange={setSendMessage}
						enabled={enableCustomMessage}
						onEnabledChange={setEnableCustomMessage}
						message={customMessage}
						onMessageChange={setCustomMessage}
						nextReviewerName={nextReviewerName || undefined}
						compact
						autoTemplate={
							nextReviewerName
								? `Hola {{reviewer_name}} 👋\n{{requester_name}} te ha asignado la revisión de este <URL_PLACEHOLDER|PR>`
								: undefined
						}
					/>
				)}
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
