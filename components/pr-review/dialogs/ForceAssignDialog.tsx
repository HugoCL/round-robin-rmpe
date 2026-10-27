"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { AlertTriangle, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { resolveAssignerDisplayName } from "@/lib/assignerDisplayName";
import { getDefaultPRChatMessageTemplate } from "@/lib/googleChatMessageTemplate";
import { parsePrUrl } from "@/lib/prUrl";
import { DuplicatePrAlert } from "../assignment/DuplicatePrAlert";
import { UrgentToggle } from "../assignment/OptionControls";
import { ChatMessageCustomizer } from "../ChatMessageCustomizer";
import {
	CHAT_OUTCOME_MESSAGE_KEYS,
	type ChatSend,
	useChatNotice,
} from "../hooks/useChatNotice";
import { useDuplicatePrCheck } from "../hooks/useDuplicatePrCheck";
import { usePRReview } from "../PRReviewContext";

interface ForceAssignDialogProps {
	/** `null` renders no trigger: the dialog is then opened through `open`. */
	trigger?: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** The PR already filled in the assignment card; the dialog opens with it. */
	draft?: { prUrl: string; contextUrl: string; urgent: boolean };
	onAssigned?: () => void;
}

export function ForceAssignDialog({
	trigger,
	open: controlledOpen,
	onOpenChange,
	draft,
	onAssigned,
}: ForceAssignDialogProps) {
	const t = useTranslations();
	const locale = useLocale();
	const { reviewers, onDataUpdate, userInfo: user, teamSlug } = usePRReview();
	const [forceDialogOpen, setForceDialogOpen] = useState(false);
	const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [urgent, setUrgent] = useState(false);
	const [enableCustomMessage, setEnableCustomMessage] = useState(false);
	const [customMessage, setCustomMessage] = useState("");
	const parsedPrUrl = parsePrUrl(prUrl);
	const hasPrUrlError = prUrl.trim().length > 0 && parsedPrUrl === null;
	const isConfirmDisabled = !selectedReviewerId || parsedPrUrl === null;
	const selectedReviewer = reviewers.find(
		(reviewer) => reviewer._id === selectedReviewerId,
	);
	const team = useQuery(api.queries.getTeam, teamSlug ? { teamSlug } : "skip");
	const duplicateCheck = useDuplicatePrCheck(teamSlug, prUrl);
	const chatDelivery = useChatNotice();
	const submittingRef = useRef(false);

	const sendChatMessage = useAction(api.actions.sendGoogleChatMessage);

	const resetDialogState = useCallback(() => {
		setSelectedReviewerId("");
		setPrUrl("");
		setContextUrl("");
		setUrgent(false);
		setEnableCustomMessage(false);
		setCustomMessage("");
	}, []);

	const isOpen = controlledOpen ?? forceDialogOpen;
	const setOpen = (open: boolean) => {
		setForceDialogOpen(open);
		onOpenChange?.(open);
		if (!open) resetDialogState();
	};

	// Seeded when it opens, not in `onOpenChange`: Radix skips that callback when
	// the parent opens the dialog through `open`.
	const [wasOpen, setWasOpen] = useState(isOpen);
	if (isOpen !== wasOpen) {
		setWasOpen(isOpen);
		if (isOpen && draft) {
			setPrUrl(draft.prUrl);
			setContextUrl(draft.contextUrl);
			setUrgent(draft.urgent);
		}
	}

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
		if (!prUrl.trim()) {
			toast({
				title: t("common.error"),
				description: t("googleChat.prUrlRequiredForAssignment"),
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
				const selfReviewer = user?.email
					? reviewers.find(
							(reviewer) =>
								reviewer.email.toLowerCase() === user.email.toLowerCase(),
						)
					: undefined;
				const assignerName = resolveAssignerDisplayName({
					email: user?.email,
					firstName: user?.firstName,
					lastName: user?.lastName,
					fullName: user?.fullName,
					reviewerName: selfReviewer?.name,
				});
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

				// No webhook means the action can only fail; skip it instead of
				// reporting a failure nobody can fix from here.
				let chatSend: ChatSend | null = null;
				if (
					teamSlug &&
					forcedReviewer &&
					team?.hasGoogleChatWebhook !== false
				) {
					const payload = {
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
					};
					chatSend = () => sendChatMessage(payload);
				}
				const chatOutcome = chatSend ? await chatDelivery.send(chatSend) : null;

				const assignedText = t(
					result.reviewer.effectiveIsAbsent
						? "messages.forceAssignAbsentWarning"
						: "messages.forceAssignSuccess",
					{
						reviewer: result.reviewer.name,
						number: parsedPrUrl?.number ?? "",
					},
				);
				const message =
					chatOutcome === null
						? assignedText
						: `${assignedText} ${t(CHAT_OUTCOME_MESSAGE_KEYS[chatOutcome], {
								count: 1,
							})}`;
				toast(
					chatOutcome === "failed" && chatSend
						? {
								title: t("common.warning"),
								description: message,
								variant: "destructive",
								action: chatDelivery.retryAction(chatSend),
								// A retry nobody saw is a notice nobody got; it stays until dismissed.
								duration: Number.POSITIVE_INFINITY,
							}
						: { description: message },
				);

				setOpen(false);
				onAssigned?.();
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

	const handleConfirm = async () => {
		if (isConfirmDisabled || submittingRef.current) return;
		submittingRef.current = true;
		try {
			// The first attempt on an already-assigned PR only surfaces the warning.
			await duplicateCheck.submit(handleForceAssign);
		} finally {
			submittingRef.current = false;
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setOpen}>
			{trigger === null ? null : (
				<DialogTrigger asChild>
					{trigger || (
						<Button variant="outline" className="w-full">
							<UserCheck className="h-4 w-4 mr-2" />
							{t("pr.forceAssign")} PR
						</Button>
					)}
				</DialogTrigger>
			)}
			<DialogContent className="sm:max-w-135">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
							<UserCheck className="h-4 w-4" />
						</span>
						<DialogTitle>{t("reviewer.forceAssignTitle")}</DialogTitle>
					</div>
					<DialogDescription>
						{t("reviewer.forceAssignDescription")}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Select
						value={selectedReviewerId}
						onValueChange={setSelectedReviewerId}
					>
						<SelectTrigger
							className="w-full border-control-border"
							aria-label={t("pr.slotReviewerLabel")}
						>
							<SelectValue placeholder={t("reviewer.selectReviewer")} />
						</SelectTrigger>
						<SelectContent>
							{reviewers
								.filter((r) => r.excludedFromReviewPool !== true)
								.map((reviewer) => (
									<SelectItem key={reviewer._id} value={reviewer._id}>
										<div className="flex items-center">
											<span>
												{reviewer.name}
												{reviewer.email.toLowerCase() ===
												user?.email?.toLowerCase() ? (
													<span className="text-muted-foreground">
														{" "}
														{t("common.youSuffix")}
													</span>
												) : null}
											</span>
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
							<div className="calm-subtle-panel flex items-center gap-1 p-3 text-sm text-amber-500">
								<AlertTriangle className="h-4 w-4 mr-1" />
								<span>{t("tags.absent")}</span>
							</div>
						)}

					<div className="flex flex-wrap gap-2">
						<UrgentToggle pressed={urgent} onPressedChange={setUrgent} />
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
						nextReviewerName={
							reviewers.find((r) => r._id === selectedReviewerId)?.name
						}
						compact
						autoTemplate={getDefaultPRChatMessageTemplate(locale)}
						onSubmitShortcut={() => void handleConfirm()}
					/>
					{hasPrUrlError ? (
						<p className="text-xs text-destructive">{t("pr.prUrlInvalid")}</p>
					) : duplicateCheck.duplicate ? (
						<DuplicatePrAlert duplicate={duplicateCheck.duplicate} />
					) : prUrl.trim() || !team?.hasGoogleChatWebhook ? null : (
						<p className="text-xs text-muted-foreground">
							{t("googleChat.prUrlRequiredForAssignment")}
						</p>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						{t("common.cancel")}
					</Button>
					<Button
						onClick={() => void handleConfirm()}
						disabled={isConfirmDisabled}
					>
						{selectedReviewer
							? t(
									!duplicateCheck.duplicate
										? "pr.assignTo"
										: duplicateCheck.duplicate.reviewerName ===
												selectedReviewer.name
											? "pr.assignAgainToSame"
											: "pr.assignAlsoTo",
									{ name: selectedReviewer.name },
								)
							: t("pr.assignShort")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
