"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { AlertCircle, Tag, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";

import { ChatMessageCustomizer } from "./ChatMessageCustomizer";
import { usePRReview } from "./PRReviewContext";

export function TrackBasedAssignment() {
	const t = useTranslations();
	const { reviewers, onDataUpdate, userInfo: user, teamSlug } = usePRReview();

	const [selectedTagId, setSelectedTagId] = useState<Id<"tags"> | undefined>(
		undefined,
	);
	const [isOpen, setIsOpen] = useState(false);
	const [isAssigning, setIsAssigning] = useState(false);

	// Chat message state
	const [sendMessage, setSendMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [customMessage, setCustomMessage] = useState("");
	const [enableCustomMessage, setEnableCustomMessage] = useState(false);
	// PR duplicate validation
	const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
	const [duplicateAssignment, setDuplicateAssignment] = useState<{
		reviewerName: string;
		timestamp: number;
	} | null>(null);

	// Use Convex hooks for real-time data
	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") || [];
	const assignPRMutation = useMutation(api.mutations.assignPR);
	const createActivePRAssignment = useMutation(
		api.mutations.createActivePRAssignment,
	);
	const sendGoogleChatAction = useAction(api.actions.sendGoogleChatMessage);
	const checkPRAlreadyAssignedAction = useAction(
		api.actions.checkPRAlreadyAssigned,
	);
	const getNextReviewerByTag = useQuery(
		api.queries.getNextReviewerByTag,
		selectedTagId && teamSlug ? { teamSlug, tagId: selectedTagId } : "skip",
	);

	// Get next reviewer for selected tag
	const nextReviewer = getNextReviewerByTag || null;

	// Handle PR URL blur to check for duplicates
	const handlePrUrlBlur = async () => {
		const trimmedUrl = prUrl.trim();
		if (!trimmedUrl || !teamSlug) {
			setShowDuplicateAlert(false);
			return;
		}

		try {
			const existing = await checkPRAlreadyAssignedAction({
				teamSlug,
				prUrl: trimmedUrl,
			});

			if (existing) {
				setDuplicateAssignment({
					reviewerName: existing.reviewerName,
					timestamp: existing.timestamp,
				});
				setShowDuplicateAlert(true);
			} else {
				setShowDuplicateAlert(false);
			}
		} catch (error) {
			console.error("Error checking for duplicate PR:", error);
		}
	};

	const handleAssignPR = async () => {
		if (!selectedTagId || !nextReviewer) return;

		setIsAssigning(true);
		try {
			const actionByReviewerId = user
				? reviewers.find(
						(r) => r.email.toLowerCase() === user.email.toLowerCase(),
					)?._id
				: undefined;
			const result = await assignPRMutation({
				reviewerId: nextReviewer._id as Id<"reviewers">,
				tagId: selectedTagId as Id<"tags">, // Pass the tag ID for tracking
				prUrl: prUrl.trim() || undefined,
				actionByReviewerId,
			});

			if (result.success && result.reviewer) {
				// Create active assignment row (tag-based)
				try {
					const assigner = reviewers.find(
						(r) => r.email.toLowerCase() === user?.email.toLowerCase(),
					);
					if (assigner && teamSlug) {
						await createActivePRAssignment({
							teamSlug,
							assigneeId: nextReviewer._id as Id<"reviewers">,
							assignerId: assigner._id as Id<"reviewers">,
							prUrl: prUrl.trim() || undefined,
						});
					}
				} catch (e) {
					console.warn("Failed to create active assignment (track)", e);
				}

				// Send Google Chat message if enabled
				if (sendMessage && prUrl.trim() && teamSlug) {
					try {
						const assignerName =
							user?.firstName && user?.lastName
								? `${user.firstName} ${user.lastName}`
								: user?.firstName || user?.lastName || "Unknown";
						await sendGoogleChatAction({
							reviewerName: nextReviewer.name,
							reviewerEmail: nextReviewer.email,
							reviewerChatId:
								(nextReviewer as unknown as { googleChatUserId?: string })
									.googleChatUserId || undefined,
							prUrl,
							contextUrl: contextUrl.trim() || undefined,
							locale: "es",
							assignerEmail: user?.email,
							assignerName,
							teamSlug,
							sendOnlyNames: false,
							customMessage:
								enableCustomMessage && customMessage.trim().length > 0
									? customMessage
									: undefined,
						});
					} catch (err) {
						console.error("Failed to send Google Chat message:", err);
					}
				}

				// Update the parent component's data first
				await onDataUpdate();

				const selectedTag = tags.find(
					(t: Doc<"tags">) => t._id === selectedTagId,
				);
				toast({
					title: t("common.success"),
					description: t("messages.trackAssignSuccess", {
						reviewer: result.reviewer.name,
						tag: selectedTag?.name || "",
					}),
				});

				// Close dialog and reset state
				setIsOpen(false);
				setSelectedTagId(undefined);
				// Reset message state
				setSendMessage(false);
				setPrUrl("");
				setContextUrl("");
				setCustomMessage("");
				setEnableCustomMessage(false);
			} else {
				toast({
					title: t("common.error"),
					description: t("messages.trackAssignFailed"),
					variant: "destructive",
				});
			}
		} catch (error) {
			console.error("Error assigning PR:", error);
			toast({
				title: t("common.error"),
				description: t("messages.trackAssignFailed"),
				variant: "destructive",
			});
		} finally {
			setIsAssigning(false);
		}
	};

	const getReviewersForTag = (tagId: Id<"tags">) => {
		return reviewers.filter((r) => r.tags?.includes(tagId) && !r.isAbsent);
	};

	const getTagStats = (tagId: Id<"tags">) => {
		const tagReviewers = getReviewersForTag(tagId);
		const totalReviewers = tagReviewers.length;
		const availableReviewers = tagReviewers.filter((r) => !r.isAbsent).length;

		return { totalReviewers, availableReviewers };
	};

	const resetAndClose = () => {
		setSelectedTagId(undefined);
		setSendMessage(false);
		setPrUrl("");
		setContextUrl("");
		setCustomMessage("");
		setEnableCustomMessage(false);
		setShowDuplicateAlert(false);
		setDuplicateAssignment(null);
		setIsOpen(false);
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) {
					resetAndClose();
				} else {
					setIsOpen(open);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" className="w-full">
					<Tag className="h-4 w-4 mr-2" />
					{t("tags.assignBasedOnTags")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-125">
				<DialogHeader>
					<DialogTitle>{t("tags.tagBasedAssignment")}</DialogTitle>
					<DialogDescription>{t("tags.tagBasedDescription")}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<label
							htmlFor="tag-select"
							className="block text-sm font-medium mb-2"
						>
							{t("tags.selectTag")}
						</label>
						<Select
							value={selectedTagId}
							onValueChange={(value) => setSelectedTagId(value as Id<"tags">)}
						>
							<SelectTrigger>
								<SelectValue placeholder={t("tags.chooseTag")} />
							</SelectTrigger>
							<SelectContent>
								{tags.map((tag: Doc<"tags">) => {
									const stats = getTagStats(tag._id);
									return (
										<SelectItem key={tag._id} value={tag._id}>
											<div className="flex items-center gap-2">
												<div
													className="w-3 h-3 "
													style={{ backgroundColor: tag.color }}
												/>
												<span>{tag.name}</span>
												<Badge variant="secondary" className="ml-auto">
													{stats.availableReviewers}/{stats.totalReviewers}
												</Badge>
											</div>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</div>

					{selectedTagId && (
						<Card>
							<CardHeader>
								<CardTitle className="text-lg flex items-center gap-2">
									<div
										className="w-4 h-4 "
										style={{
											backgroundColor: tags.find(
												(t: Doc<"tags">) => t._id === selectedTagId,
											)?.color,
										}}
									/>
									{tags.find((t: Doc<"tags">) => t._id === selectedTagId)?.name}
								</CardTitle>
								<CardDescription>
									{
										tags.find((t: Doc<"tags">) => t._id === selectedTagId)
											?.description
									}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{nextReviewer ? (
									<div className="space-y-4">
										<div className="text-center">
											<div className="text-sm font-medium text-muted-foreground mb-1">
												{t("tags.nextReviewer")}
											</div>
											<div className="text-2xl font-bold text-primary">
												{nextReviewer.name}
											</div>
											<div className="text-sm text-muted-foreground">
												{nextReviewer.assignmentCount} {t("tags.assignments")}
											</div>
										</div>

										<div className="border-t pt-4">
											<div className="flex items-center justify-between text-sm">
												<span className="text-muted-foreground">
													{t("tags.availableReviewers")}
												</span>
												<div className="flex items-center gap-1">
													<Users className="h-4 w-4" />
													<span>
														{getTagStats(selectedTagId).availableReviewers}
													</span>
												</div>
											</div>
										</div>
									</div>
								) : (
									<div className="text-center py-4">
										<p className="text-sm text-muted-foreground">
											{t("tags.noAvailableReviewers")}
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{selectedTagId && (
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">
									{t("tags.availableReviewers")}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{getReviewersForTag(selectedTagId).map((reviewer) => (
										<div
											key={reviewer._id}
											className="flex items-center justify-between"
										>
											<span className="text-sm">
												{reviewer.name}
												{reviewer._id === nextReviewer?._id && (
													<Badge className="ml-2 bg-green-500">
														{t("tags.next")}
													</Badge>
												)}
											</span>
											<span className="text-sm text-muted-foreground">
												{reviewer.assignmentCount} {t("tags.assignments")}
											</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Duplicate PR Alert */}
					{showDuplicateAlert && duplicateAssignment && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								Este PR ya fue asignado a{" "}
								<strong>{duplicateAssignment.reviewerName}</strong> el{" "}
								{new Date(duplicateAssignment.timestamp).toLocaleDateString()}
							</AlertDescription>
						</Alert>
					)}

					{/* Chat Message Customizer */}
					{selectedTagId && nextReviewer && (
						<ChatMessageCustomizer
							prUrl={prUrl}
							onPrUrlChange={(value) => {
								setPrUrl(value);
								if (showDuplicateAlert) setShowDuplicateAlert(false);
							}}
							onPrUrlBlur={handlePrUrlBlur}
							contextUrl={contextUrl}
							onContextUrlChange={setContextUrl}
							sendMessage={sendMessage}
							onSendMessageChange={setSendMessage}
							enabled={enableCustomMessage}
							onEnabledChange={(val) => {
								setEnableCustomMessage(val);
								if (!val) setCustomMessage("");
							}}
							message={customMessage}
							onMessageChange={setCustomMessage}
							nextReviewerName={nextReviewer?.name}
						/>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={resetAndClose}>
						{t("common.cancel")}
					</Button>
					<Button
						onClick={handleAssignPR}
						disabled={
							!selectedTagId ||
							!nextReviewer ||
							isAssigning ||
							(sendMessage && !prUrl.trim())
						}
					>
						{isAssigning ? t("tags.assigning") : t("pr.assignPR")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
