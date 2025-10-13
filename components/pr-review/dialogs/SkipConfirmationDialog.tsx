"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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
import { ChatMessageCustomizer } from "../ChatMessageCustomizer";
import { usePRReview } from "../PRReviewContext";

export interface SkipConfirmationOptions {
	sendMessage: boolean;
	prUrl: string;
	enableCustomMessage: boolean;
	customMessage: string;
}

interface SkipConfirmationDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	nextAfterSkip: Doc<"reviewers"> | null;
	onConfirm: (options: SkipConfirmationOptions) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export function SkipConfirmationDialog({
	isOpen,
	onOpenChange,
	nextAfterSkip,
	onConfirm,
	onCancel,
	isSubmitting = false,
}: SkipConfirmationDialogProps) {
	const t = useTranslations();
	const { nextReviewer } = usePRReview();
	const [sendMessage, setSendMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [enableCustomMessage, setEnableCustomMessage] = useState(false);
	const [customMessage, setCustomMessage] = useState("");

	useEffect(() => {
		if (!isOpen) {
			setSendMessage(false);
			setPrUrl("");
			setContextUrl("");
			setEnableCustomMessage(false);
			setCustomMessage("");
		}
	}, [isOpen]);

	useEffect(() => {
		if (!nextAfterSkip) {
			setSendMessage(false);
			setEnableCustomMessage(false);
			setCustomMessage("");
		}
	}, [nextAfterSkip]);

	const handleConfirm = async () => {
		await onConfirm({
			sendMessage,
			prUrl: prUrl.trim(),
			enableCustomMessage,
			customMessage: customMessage.trim(),
		});
	};

	const disableConfirm =
		isSubmitting || (sendMessage && prUrl.trim().length === 0);

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
						nextReviewerName={nextAfterSkip?.name}
						compact
					/>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleConfirm} disabled={disableConfirm}>
						{isSubmitting ? t("tags.assigning") : t("common.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
