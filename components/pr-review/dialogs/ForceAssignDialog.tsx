"use client";

import { useAction, useMutation } from "convex/react";
import { AlertTriangle, Info, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
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
import { Toggle } from "@/components/ui/toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { getDefaultPRChatMessageTemplate } from "@/lib/googleChatMessageTemplate";
import { ChatMessageCustomizer } from "../ChatMessageCustomizer";

import { usePRReview } from "../PRReviewContext";

const selectedUrgentChipStyle = {
	backgroundColor: "#dc2626",
	borderColor: "#dc2626",
	color: "#ffffff",
};

interface ForceAssignDialogProps {
	trigger?: React.ReactNode;
}

export function ForceAssignDialog({ trigger }: ForceAssignDialogProps) {
	const t = useTranslations();
	const locale = useLocale();
	const {
		reviewers,
		onDataUpdate,
		userInfo: user,
		teamSlug,
		alwaysSendGoogleChatMessage,
	} = usePRReview();
	const [forceDialogOpen, setForceDialogOpen] = useState(false);
	const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
	// Chat message customization state (unified component)
	const [sendMessage, setSendMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [urgent, setUrgent] = useState(false);
	const [enableCustomMessage, setEnableCustomMessage] = useState(false);
	const [customMessage, setCustomMessage] = useState("");
	const effectiveSendMessage = alwaysSendGoogleChatMessage || sendMessage;
	const isConfirmDisabled =
		!selectedReviewerId || (effectiveSendMessage && prUrl.trim().length === 0);

	useEffect(() => {
		if (!alwaysSendGoogleChatMessage || sendMessage) return;
		setSendMessage(true);
	}, [alwaysSendGoogleChatMessage, sendMessage]);

	const sendChatMessage = useAction(api.actions.sendGoogleChatMessage);

	const resetDialogState = useCallback(() => {
		setSelectedReviewerId("");
		setSendMessage(false);
		setPrUrl("");
		setContextUrl("");
		setUrgent(false);
		setEnableCustomMessage(false);
		setCustomMessage("");
	}, []);

	// Use Convex mutation for force assignment & active assignment creation
	const assignPRMutation = useMutation(api.mutations.assignPR);
	const createActivePRAssignment = useMutation(
		api.mutations.createActivePRAssignment,
	);

	const handleForceAssign = async () => {
		if (!selectedReviewerId) {
			toast({
				title: t("common.error"),
				description: t("messages.selectReviewerError"),
				variant: "destructive",
			});
			return;
		}
		if (effectiveSendMessage && !prUrl.trim()) {
			toast({
				title: t("common.error"),
				description: t("mySettings.prUrlRequiredWhenMessageIsForced"),
				variant: "destructive",
			});
			return;
		}

		try {
			const actionByReviewerId = user
				? reviewers.find(
						(r) => r.email.toLowerCase() === user.email.toLowerCase(),
					)?._id
				: undefined;
			const result = await assignPRMutation({
				reviewerId: selectedReviewerId as Id<"reviewers">,
				forced: true, // Mark as forced assignment
				prUrl: prUrl.trim() || undefined,
				contextUrl: contextUrl.trim() || undefined,
				urgent,
				actionByReviewerId,
			});

			if (result.success && result.reviewer) {
				const forcedReviewer = reviewers.find(
					(r) => r._id === selectedReviewerId,
				);
				const assignerName =
					user?.firstName && user?.lastName
						? `${user.firstName} ${user.lastName}`
						: user?.firstName || user?.lastName || "Unknown";
				// Create active assignment row (force)
				try {
					const assigner = reviewers.find(
						(r) => r.email.toLowerCase() === user?.email.toLowerCase(),
					);
					if (assigner && teamSlug) {
						await createActivePRAssignment({
							teamSlug,
							assigneeId: selectedReviewerId as Id<"reviewers">,
							assignerId: assigner._id as Id<"reviewers">,
							prUrl: prUrl.trim() || undefined,
							urgent,
						});
					}
				} catch (e) {
					console.warn("Failed to create active assignment (force)", e);
				}
				// Refresh data to get updated reviewers and feed
				await onDataUpdate();

				// Optionally send chat message (match normal assignment behavior)
				if (
					effectiveSendMessage &&
					prUrl.trim() &&
					teamSlug &&
					forcedReviewer
				) {
					try {
						await sendChatMessage({
							reviewerName: forcedReviewer.name,
							reviewerEmail: forcedReviewer.email,
							reviewerChatId: forcedReviewer.googleChatUserId,
							prUrl: prUrl.trim(),
							contextUrl: contextUrl.trim() || undefined,
							assignerEmail: user?.email,
							assignerName,
							locale,
							teamSlug,
							sendOnlyNames: false,
							urgent,
							customMessage:
								enableCustomMessage && customMessage.trim().length > 0
									? customMessage
									: undefined,
						});
					} catch (e) {
						console.warn("Failed to send chat message for forced assign", e);
					}
				}

				// Show appropriate toast based on reviewer status
				if (result.reviewer.effectiveIsAbsent) {
					toast({
						title: t("pr.forceAssign"),
						description: t("messages.forceAssignAbsentWarning", {
							reviewer: result.reviewer.name,
						}),
					});
				} else {
					toast({
						title: t("pr.forceAssign"),
						description: t("messages.forceAssignSuccess", {
							reviewer: result.reviewer.name,
						}),
					});
				}

				// Close the dialog
				setForceDialogOpen(false);
				resetDialogState();
			} else {
				toast({
					title: t("common.error"),
					description: t("messages.forceAssignFailed"),
					variant: "destructive",
				});
			}
		} catch (error) {
			console.error("Error force assigning reviewer:", error);
			toast({
				title: t("common.error"),
				description: t("messages.forceAssignFailed"),
				variant: "destructive",
			});
		}
	};

	return (
		<Dialog
			open={forceDialogOpen}
			onOpenChange={(open) => {
				setForceDialogOpen(open);
				if (!open) {
					resetDialogState();
				}
			}}
		>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="outline" className="w-full">
						<UserCheck className="h-4 w-4 mr-2" />
						{t("pr.forceAssign")} PR
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-135">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<span className="inline-flex h-10 w-10 items-center justify-center  bg-primary/10 text-primary">
							<UserCheck className="h-4 w-4" />
						</span>
						<DialogTitle>{t("reviewer.forceAssignTitle")}</DialogTitle>
					</div>
					<DialogDescription>
						{t("reviewer.forceAssignDescription")}
						<span className="block text-[11px] text-muted-foreground mt-1">
							{t("hints.reviewConfirm")}
						</span>
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<Select
						value={selectedReviewerId}
						onValueChange={setSelectedReviewerId}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("reviewer.selectReviewer")} />
						</SelectTrigger>
						<SelectContent>
							{reviewers.map((reviewer) => (
								<SelectItem key={reviewer._id} value={reviewer._id}>
									<div className="flex items-center">
										<span>{reviewer.name}</span>
										{reviewer.effectiveIsAbsent && (
											<AlertTriangle className="h-4 w-4 ml-2 text-amber-500" />
										)}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{selectedReviewerId &&
						reviewers.find((r) => r._id === selectedReviewerId)
							?.effectiveIsAbsent && (
							<div className="mt-2 text-sm text-amber-500 flex items-center">
								<AlertTriangle className="h-4 w-4 mr-1" />
								<span>{t("tags.absent")}</span>
							</div>
						)}

					<div className="mt-4 flex flex-wrap gap-2">
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
						sendMessage={effectiveSendMessage}
						onSendMessageChange={(value) => {
							if (alwaysSendGoogleChatMessage) return;
							setSendMessage(value);
						}}
						enabled={enableCustomMessage}
						onEnabledChange={setEnableCustomMessage}
						message={customMessage}
						onMessageChange={setCustomMessage}
						nextReviewerName={
							reviewers.find((r) => r._id === selectedReviewerId)?.name
						}
						showSendToggle={!alwaysSendGoogleChatMessage}
						compact
						autoTemplate={getDefaultPRChatMessageTemplate(locale)}
					/>
					{effectiveSendMessage && (
						<p className="text-xs text-muted-foreground">
							{t("mySettings.prUrlRequiredWhenMessageIsForced")}
						</p>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setForceDialogOpen(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleForceAssign} disabled={isConfirmDisabled}>
						{t("pr.forceAssign")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
