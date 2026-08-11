"use client";

import { AlertTriangle, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { Toggle } from "@/components/ui/toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDefaultPRChatMessageTemplate } from "@/lib/googleChatMessageTemplate";
import { ChatMessageCustomizer } from "../ChatMessageCustomizer";

const selectedUrgentChipStyle = {
	backgroundColor: "#dc2626",
	borderColor: "#dc2626",
	color: "#ffffff",
};

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
	const locale = useLocale();

	const [enableCustomMessage, setEnableCustomMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [urgent, setUrgent] = useState(false);
	const [customMessage, setCustomMessage] = useState("");
	const requiresPrUrl = action === "assign" || action === "skip";
	const canConfirm = !requiresPrUrl || prUrl.trim().length > 0;

	// Expose chosen message via CustomEvent so parent can pick it up without prop drilling changes
	useEffect(() => {
		if (!isOpen) return;
		const detail = {
			prUrl: prUrl.trim() || undefined,
			contextUrl: contextUrl.trim() || undefined,
			urgent,
			message:
				enableCustomMessage && customMessage.trim().length > 0
					? customMessage
					: undefined,
		};
		window.dispatchEvent(
			new CustomEvent("shortcutDialogMessageState", { detail }),
		);
	}, [enableCustomMessage, prUrl, contextUrl, urgent, customMessage, isOpen]);

	useEffect(() => {
		if (isOpen) return;
		setEnableCustomMessage(false);
		setPrUrl("");
		setContextUrl("");
		setUrgent(false);
		setCustomMessage("");
	}, [isOpen]);

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
				if (!canConfirm) return;
				onConfirm(action);
			} else if (key === "n" || key === "escape") {
				e.preventDefault();
				onCancel();
			}
		},
		[isOpen, action, onConfirm, onCancel, canConfirm],
	);

	useEffect(() => {
		if (isOpen) {
			window.addEventListener("keydown", handleKey);
			return () => window.removeEventListener("keydown", handleKey);
		}
	}, [isOpen, handleKey]);

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-115">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
							<span className="text-sm font-semibold">⌘</span>
						</span>
						<DialogTitle>{t("shortcutConfirm.title")}</DialogTitle>
					</div>
					{action && (
						<DialogDescription>
							{base[action]} {detailed ? <span>{detailed} </span> : null}
							{t("shortcutConfirm.confirmHint")}
							<span className="mt-1 block text-[11px] text-muted-foreground">
								Enter / Y to confirm · Esc / N to cancel
							</span>
						</DialogDescription>
					)}
				</DialogHeader>
				{action && (action === "assign" || action === "skip") && (
					<>
						<div className="flex flex-wrap gap-2">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Toggle
											pressed={urgent}
											onPressedChange={setUrgent}
											variant="outline"
											size="sm"
											aria-label={t("googleChat.urgentToggle")}
											className="cursor-pointer rounded-full border-red-200/80 bg-transparent px-3 text-xs text-red-700 transition-all duration-150 dark:border-red-900/50 dark:text-red-300"
											style={urgent ? selectedUrgentChipStyle : undefined}
										>
											<AlertTriangle className="h-3.5 w-3.5" />
											{t("googleChat.urgentToggle")}
											<Info
												className={`h-3.5 w-3.5 ${
													urgent ? "text-white/80" : "text-muted-foreground/90"
												}`}
											/>
										</Toggle>
									</TooltipTrigger>
									<TooltipContent className="max-w-64 text-xs">
										<p>{t("googleChat.urgentToggleDescription")}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>

						<ChatMessageCustomizer
							prUrl={prUrl}
							onPrUrlChange={setPrUrl}
							contextUrl={contextUrl}
							onContextUrlChange={setContextUrl}
							enabled={enableCustomMessage}
							onEnabledChange={setEnableCustomMessage}
							message={customMessage}
							onMessageChange={setCustomMessage}
							nextReviewerName={nextReviewerName || undefined}
							compact
							autoTemplate={
								nextReviewerName
									? getDefaultPRChatMessageTemplate(locale)
									: undefined
							}
						/>
					</>
				)}
				{requiresPrUrl && (
					<p className="calm-subtle-panel p-3 text-xs text-muted-foreground">
						{t("googleChat.prUrlRequiredForAssignment")}
					</p>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						{t("common.cancel")}
					</Button>
					{action && (
						<Button onClick={() => onConfirm(action)} disabled={!canConfirm}>
							{actionLabels[action]}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
