"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { AlertCircle, Info, Sparkles, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { ChatMessageCustomizer } from "./ChatMessageCustomizer";
import { usePRReview } from "./PRReviewContext";

type AssignmentMode = "regular" | "tag";

export function AssignmentCard() {
	const t = useTranslations();
	const {
		teamSlug,
		nextReviewer,
		reviewers,
		assignmentFeed,
		assignPR: onAssignPR,
		undoAssignment: onUndoAssignment,
		autoSkipAndAssign,
		userInfo: user,
	} = usePRReview();

	const [isAssigning, setIsAssigning] = useState(false);
	const [sendMessage, setSendMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [customMessage, setCustomMessage] = useState("");
	const [enableCustomMessage, setEnableCustomMessage] = useState(false);
	const [mode, setMode] = useState<AssignmentMode>("regular");
	const [selectedTagId, setSelectedTagId] = useState<Id<"tags"> | undefined>(
		undefined,
	);

	const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
	const [duplicateAssignment, setDuplicateAssignment] = useState<{
		reviewerName: string;
		timestamp: number;
	} | null>(null);

	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") || [];
	const nextReviewerByTag = useQuery(
		api.queries.getNextReviewerByTag,
		mode === "tag" && selectedTagId && teamSlug
			? { teamSlug, tagId: selectedTagId }
			: "skip",
	);

	const sendGoogleChatAction = useAction(api.actions.sendGoogleChatMessage);
	const checkPRAlreadyAssignedAction = useAction(
		api.actions.checkPRAlreadyAssigned,
	);
	const createActivePRAssignment = useMutation(
		api.mutations.createActivePRAssignment,
	);
	const assignPRMutation = useMutation(api.mutations.assignPR);

	const selectedTag = useMemo(
		() => tags.find((tag: Doc<"tags">) => tag._id === selectedTagId),
		[selectedTagId, tags],
	);

	const activeNextReviewer =
		mode === "tag" ? nextReviewerByTag || null : nextReviewer;
	const isLoadingTagReviewer =
		mode === "tag" &&
		!!selectedTagId &&
		typeof nextReviewerByTag === "undefined";

	const isCurrentUserNext =
		mode === "regular" &&
		!!user?.email &&
		!!nextReviewer?.email &&
		user.email.toLowerCase() === nextReviewer.email.toLowerCase();

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

	const getActionByReviewerId = () => {
		if (!user?.email) return undefined;
		return reviewers.find(
			(reviewer) => reviewer.email.toLowerCase() === user.email.toLowerCase(),
		)?._id;
	};

	const getAssignerName = () =>
		user?.firstName && user?.lastName
			? `${user.firstName} ${user.lastName}`
			: user?.firstName || user?.lastName || "Unknown";

	const createActiveAssignmentRow = async (assigneeId: Id<"reviewers">) => {
		if (!user?.email || !teamSlug) return;
		const assigner = reviewers.find(
			(reviewer) => reviewer.email.toLowerCase() === user.email.toLowerCase(),
		);
		if (!assigner) return;

		try {
			await createActivePRAssignment({
				teamSlug,
				assigneeId,
				assignerId: assigner._id as Id<"reviewers">,
				prUrl: prUrl.trim() || undefined,
			});
		} catch (error) {
			console.error("Failed to create active PR assignment row", error);
		}
	};

	const sendAssignmentMessage = async (targetReviewer: Doc<"reviewers">) => {
		if (!(sendMessage && prUrl.trim() && teamSlug)) return;
		try {
			const result = await sendGoogleChatAction({
				reviewerName: targetReviewer.name,
				reviewerEmail: targetReviewer.email,
				reviewerChatId:
					(targetReviewer as unknown as { googleChatUserId?: string })
						.googleChatUserId || undefined,
				prUrl,
				contextUrl: contextUrl.trim() || undefined,
				locale: "es",
				assignerEmail: user?.email,
				assignerName: getAssignerName(),
				teamSlug,
				sendOnlyNames: false,
				customMessage:
					enableCustomMessage && customMessage.trim().length > 0
						? customMessage
						: undefined,
			});
			if (!result.success) {
				console.error("Failed to send Google Chat message:", result.error);
			}
		} catch (error) {
			console.error("Failed to send Google Chat message:", error);
		}
	};

	const handleAssignPR = async () => {
		setIsAssigning(true);
		try {
			if (mode === "tag") {
				if (!selectedTagId || !activeNextReviewer) {
					return;
				}

				const result = await assignPRMutation({
					reviewerId: activeNextReviewer._id as Id<"reviewers">,
					tagId: selectedTagId,
					prUrl: prUrl.trim() || undefined,
					contextUrl: contextUrl.trim() || undefined,
					actionByReviewerId: getActionByReviewerId(),
				});

				if (!result.success || !result.reviewer) {
					toast({
						title: t("common.error"),
						description: t("messages.trackAssignFailed"),
						variant: "destructive",
					});
					return;
				}

				await createActiveAssignmentRow(
					activeNextReviewer._id as Id<"reviewers">,
				);
				await sendAssignmentMessage(activeNextReviewer);

				toast({
					title: t("common.success"),
					description: t("messages.trackAssignSuccess", {
						reviewer: result.reviewer.name,
						tag: selectedTag?.name || "",
					}),
				});
				return;
			}

			if (isCurrentUserNext) {
				const nextAfter = findNextAfterCurrent();
				await autoSkipAndAssign({
					prUrl: prUrl.trim() || undefined,
					contextUrl: contextUrl.trim() || undefined,
				});
				if (nextAfter) {
					await sendAssignmentMessage(nextAfter);
				}
				return;
			}

			if (!nextReviewer) return;
			const currentNext = nextReviewer;
			await onAssignPR({
				prUrl: prUrl.trim() || undefined,
				contextUrl: contextUrl.trim() || undefined,
			});
			await createActiveAssignmentRow(currentNext._id as Id<"reviewers">);
			await sendAssignmentMessage(currentNext);
		} finally {
			setTimeout(() => setIsAssigning(false), 600);
		}
	};

	const findNextAfterCurrent = (): Doc<"reviewers"> | null => {
		if (!nextReviewer || reviewers.length === 0) return null;
		const availableReviewers = reviewers.filter(
			(reviewer) => !reviewer.isAbsent,
		);
		if (availableReviewers.length === 0) return null;
		const minCount = Math.min(
			...availableReviewers.map((reviewer) => reviewer.assignmentCount),
		);
		const candidatesWithMin = availableReviewers.filter(
			(reviewer) =>
				reviewer.assignmentCount === minCount &&
				reviewer._id !== nextReviewer._id,
		);
		if (candidatesWithMin.length > 0) {
			return (
				[...candidatesWithMin].sort((a, b) => a.createdAt - b.createdAt)[0] ||
				null
			);
		}
		const higher = availableReviewers.filter(
			(reviewer) => reviewer.assignmentCount > minCount,
		);
		if (!higher.length) return null;
		const nextMin = Math.min(
			...higher.map((reviewer) => reviewer.assignmentCount),
		);
		const nextCandidates = availableReviewers.filter(
			(reviewer) => reviewer.assignmentCount === nextMin,
		);
		return (
			[...nextCandidates].sort((a, b) => a.createdAt - b.createdAt)[0] || null
		);
	};

	const getTagStats = (tagId: Id<"tags">) => {
		const tagReviewers = reviewers.filter((reviewer) =>
			reviewer.tags?.includes(tagId),
		);
		const availableReviewers = tagReviewers.filter(
			(reviewer) => !reviewer.isAbsent,
		);
		return {
			totalReviewers: tagReviewers.length,
			availableReviewers: availableReviewers.length,
		};
	};

	const lastAssignedReviewer = assignmentFeed.lastAssigned?.reviewerId
		? reviewers.find(
				(reviewer) => reviewer._id === assignmentFeed.lastAssigned?.reviewerId,
			)
		: null;
	const nextAfterCurrent = findNextAfterCurrent();

	const isAssignDisabled =
		!activeNextReviewer ||
		isAssigning ||
		(sendMessage && !prUrl.trim()) ||
		(mode === "tag" && !selectedTagId);

	return (
		<Card className="flex flex-col overflow-hidden">
			<CardHeader className="flex-shrink-0" />
			<CardContent className="flex-1 flex items-center justify-center">
				{activeNextReviewer ? (
					<div className="text-center py-8 w-full space-y-6 overflow-hidden">
						{mode === "regular" && lastAssignedReviewer && (
							<div className="space-y-1">
								<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									{t("pr.lastAssigned")}
								</span>
								<h4
									className={`text-lg font-medium text-muted-foreground opacity-80 transition-all duration-300 ${
										isAssigning
											? "opacity-0 translate-y-1"
											: "opacity-80 translate-y-0"
									}`}
								>
									{lastAssignedReviewer.name}
								</h4>
							</div>
						)}

						<div className="space-y-2">
							<div className="mb-2">
								<span className="inline-flex items-center gap-2 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25 dark:bg-white/12 dark:text-white dark:ring-white/20">
									<Sparkles className="h-3 w-3" />
									{mode === "tag"
										? t("tags.nextReviewer")
										: t("pr.nextReviewer")}
								</span>
							</div>
							<div className="relative mx-auto max-w-xl overflow-hidden bg-gradient-to-br from-primary/20 via-primary/16 to-primary/10 p-7 shadow-md ring-1 ring-primary/14 border border-white/6 dark:from-primary/28 dark:via-primary/32 dark:to-primary/20 dark:ring-primary/30 dark:border-white/5">
								<div
									className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.25),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.14),transparent_45%)] dark:bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.08),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.22),transparent_45%)]"
									aria-hidden
								/>
								<div className="relative space-y-2">
									<h3
										className={`text-4xl md:text-5xl font-bold text-primary dark:text-white drop-shadow-lg transition-all duration-300 ${
											isAssigning
												? "opacity-0 translate-y-1"
												: "opacity-100 translate-y-0"
										}`}
									>
										{activeNextReviewer.name}
									</h3>
									{mode === "tag" && selectedTag && (
										<div className="flex justify-center">
											<Badge
												variant="secondary"
												style={{
													backgroundColor: `${selectedTag.color}20`,
													color: selectedTag.color,
													borderColor: selectedTag.color,
												}}
											>
												{selectedTag.name}
											</Badge>
										</div>
									)}
								</div>
							</div>
						</div>

						{isCurrentUserNext && nextAfterCurrent && (
							<div className="flex justify-center">
								<Alert className="max-w-xl w-full bg-muted/50">
									<Info className="h-4 w-4" />
									<AlertDescription className="text-sm">
										{t("pr.autoSkipDescription", {
											nextReviewer: nextAfterCurrent.name,
										})}
									</AlertDescription>
								</Alert>
							</div>
						)}

						{mode === "regular" && nextAfterCurrent && (
							<div className="space-y-1">
								<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									{t("pr.upNext")}
								</span>
								<h4
									className={`text-lg font-medium text-muted-foreground transition-all duration-300 ${
										isAssigning
											? "opacity-0 translate-y-1"
											: "opacity-100 translate-y-0"
									}`}
								>
									{nextAfterCurrent.name}
								</h4>
							</div>
						)}
					</div>
				) : (
					<div className="text-center p-6 border-2 border-muted bg-muted w-full">
						{mode === "tag" ? (
							selectedTagId ? (
								<p className="text-sm text-muted-foreground">
									{isLoadingTagReviewer
										? t("tags.findingNextReviewer")
										: t("tags.noAvailableReviewers")}
								</p>
							) : (
								<p className="text-sm text-muted-foreground">
									{t("tags.selectTag")}
								</p>
							)
						) : (
							<>
								<h3 className="text-xl font-medium text-muted-foreground mb-2">
									{t("pr.noAvailableReviewersTitle")}
								</h3>
								<p className="text-sm text-muted-foreground">
									{t("pr.allReviewersAbsent")}
								</p>
							</>
						)}
					</div>
				)}
			</CardContent>
			<CardFooter className="flex-shrink-0 space-y-6">
				<div className="w-full space-y-4">
					{tags.length > 0 && (
						<div className="space-y-3 border border-muted p-3 bg-muted/30">
							<div className="grid grid-cols-2 gap-2">
								<Button
									variant={mode === "regular" ? "default" : "outline"}
									size="sm"
									onClick={() => {
										setMode("regular");
										setSelectedTagId(undefined);
									}}
								>
									{t("pr.regular")}
								</Button>
								<Button
									variant={mode === "tag" ? "default" : "outline"}
									size="sm"
									onClick={() => setMode("tag")}
								>
									{t("tags.title")}
								</Button>
							</div>

							{mode === "tag" && (
								<div className="space-y-2">
									<Select
										value={selectedTagId}
										onValueChange={(value) =>
											setSelectedTagId(value as Id<"tags">)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder={t("tags.chooseTag")} />
										</SelectTrigger>
										<SelectContent>
											{tags.map((tag: Doc<"tags">) => {
												const stats = getTagStats(tag._id as Id<"tags">);
												return (
													<SelectItem key={tag._id} value={tag._id}>
														{tag.name} ({stats.availableReviewers}/
														{stats.totalReviewers})
													</SelectItem>
												);
											})}
										</SelectContent>
									</Select>
									<p className="text-xs text-muted-foreground">
										{t("tags.tagBasedDescription")}
									</p>
								</div>
							)}
						</div>
					)}

					{showDuplicateAlert && duplicateAssignment && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								{t("messages.duplicatePRAssigned", {
									reviewer: duplicateAssignment.reviewerName,
									date: new Date(
										duplicateAssignment.timestamp,
									).toLocaleDateString(),
								})}
							</AlertDescription>
						</Alert>
					)}

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
						onEnabledChange={(value) => {
							setEnableCustomMessage(value);
							if (!value) setCustomMessage("");
						}}
						message={customMessage}
						onMessageChange={setCustomMessage}
						nextReviewerName={activeNextReviewer?.name}
					/>

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<Button
								onClick={handleAssignPR}
								disabled={isAssignDisabled}
								className="flex-1 h-12 text-base"
								size="lg"
							>
								{isAssigning ? t("tags.assigning") : t("pr.assignPR")}
							</Button>

							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="outline"
											size="icon"
											className="h-12 w-12 shrink-0"
											onClick={onUndoAssignment}
											disabled={isAssigning}
										>
											<Undo2 className="h-5 w-5" />
											<span className="sr-only">
												{t("pr.undoLastAssignment")}
											</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>{t("pr.undoLastAssignment")}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>
				</div>
			</CardFooter>
		</Card>
	);
}
