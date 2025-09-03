"use client";

import { useAction, useMutation } from "convex/react";
import { AlertTriangle, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
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
import { ChatMessageCustomizer } from "../ChatMessageCustomizer";

import { usePRReview } from "../PRReviewContext";

export function ForceAssignDialog() {
	const t = useTranslations();
	const { reviewers, onDataUpdate, userInfo: user, teamSlug } = usePRReview();
	const [forceDialogOpen, setForceDialogOpen] = useState(false);
	const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
	// Chat message customization state (unified component)
	const [sendMessage, setSendMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [enableCustomMessage, setEnableCustomMessage] = useState(false);
	const [customMessage, setCustomMessage] = useState("");

	const sendChatMessage = useAction(api.actions.sendGoogleChatMessage);

	const buildDefaultTemplate = useCallback(() => {
		return (
			"📋 Hola {{reviewer_name}}!\n" +
			"{{requester_name}} te ha asignado la revisión de este <URL_PLACEHOLDER|PR>"
		);
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

		try {
			const result = await assignPRMutation({
				reviewerId: selectedReviewerId as Id<"reviewers">,
				forced: true, // Mark as forced assignment
				actionBy: user
					? {
							email: user.email,
							firstName: user.firstName,
							lastName: user.lastName,
						}
					: undefined,
			});

			if (result.success && result.reviewer) {
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
						});
					}
				} catch (e) {
					console.warn("Failed to create active assignment (force)", e);
				}
				// Refresh data to get updated reviewers and feed
				await onDataUpdate();

				// Optionally send chat message
				if (sendMessage && prUrl.trim()) {
					try {
						await sendChatMessage({
							reviewerName: result.reviewer.name,
							reviewerEmail: result.reviewer.email,
							reviewerChatId: (
								result.reviewer as unknown as { googleChatUserId?: string }
							).googleChatUserId,
							prUrl: prUrl.trim(),
							assignerEmail: user?.email,
							assignerName: user?.firstName || user?.email,
							teamSlug,
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
				if (result.reviewer.isAbsent) {
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
				setSelectedReviewerId("");
				setSendMessage(false);
				setEnableCustomMessage(false);
				setCustomMessage("");
				setPrUrl("");
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
		<Dialog open={forceDialogOpen} onOpenChange={setForceDialogOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" className="w-full">
					<UserCheck className="h-4 w-4 mr-2" />
					{t("pr.forceAssign")} PR
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>{t("reviewer.forceAssignTitle")}</DialogTitle>
					<DialogDescription>
						{t("reviewer.forceAssignDescription")}
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
										{reviewer.isAbsent && (
											<AlertTriangle className="h-4 w-4 ml-2 text-amber-500" />
										)}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{selectedReviewerId &&
						reviewers.find((r) => r._id === selectedReviewerId)?.isAbsent && (
							<div className="mt-2 text-sm text-amber-500 flex items-center">
								<AlertTriangle className="h-4 w-4 mr-1" />
								<span>{t("tags.absent")}</span>
							</div>
						)}

					<ChatMessageCustomizer
						prUrl={prUrl}
						onPrUrlChange={setPrUrl}
						sendMessage={sendMessage}
						onSendMessageChange={setSendMessage}
						enabled={enableCustomMessage}
						onEnabledChange={setEnableCustomMessage}
						message={customMessage}
						onMessageChange={setCustomMessage}
						nextReviewerName={
							reviewers.find((r) => r._id === selectedReviewerId)?.name
						}
						compact
						autoTemplate={buildDefaultTemplate()}
					/>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setForceDialogOpen(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleForceAssign}>{t("pr.forceAssign")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
