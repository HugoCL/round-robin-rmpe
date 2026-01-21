"use client";

import { useAction, useMutation } from "convex/react";
import { Info, Sparkles, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ChatMessageCustomizer } from "./ChatMessageCustomizer";
import { usePRReview } from "./PRReviewContext";

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

	const sendGoogleChatAction = useAction(api.actions.sendGoogleChatMessage);
	const createActivePRAssignment = useMutation(
		api.mutations.createActivePRAssignment,
	);

	// Check if current user is the next reviewer
	const isCurrentUserNext =
		!!user?.email &&
		!!nextReviewer?.email &&
		user.email.toLowerCase() === nextReviewer.email.toLowerCase();

	const handleAssignPR = async () => {
		// If current user is next, auto-skip and assign to the next person directly
		if (isCurrentUserNext) {
			setIsAssigning(true);
			try {
				const nextAfter = findNextAfterCurrent();
				await autoSkipAndAssign({
					prUrl: prUrl.trim() || undefined,
					contextUrl: contextUrl.trim() || undefined,
				});
				// Send Google Chat message if enabled
				if (sendMessage && prUrl.trim() && nextAfter && teamSlug) {
					try {
						const assignerName =
							user?.firstName && user?.lastName
								? `${user.firstName} ${user.lastName}`
								: user?.firstName || user?.lastName || "Unknown";
						await sendGoogleChatAction({
							reviewerName: nextAfter.name,
							reviewerEmail: nextAfter.email,
							reviewerChatId:
								(nextAfter as unknown as { googleChatUserId?: string })
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
			} finally {
				setTimeout(() => setIsAssigning(false), 600);
			}
			return;
		}

		setIsAssigning(true);
		try {
			const currentNext = nextReviewer; // capture before assignment changes
			await onAssignPR({
				prUrl: prUrl.trim() || undefined,
				contextUrl: contextUrl.trim() || undefined,
			});
			// Create active assignment row if we have PR URL and participants
			if (currentNext && user?.email && teamSlug) {
				// Find assigner reviewer record (could be same as assignee sometimes?)
				const assigner = reviewers.find(
					(r) => r.email.toLowerCase() === user.email.toLowerCase(),
				);
				if (assigner) {
					try {
						await createActivePRAssignment({
							teamSlug,
							assigneeId: currentNext._id as unknown as Id<"reviewers">,
							assignerId: assigner._id as unknown as Id<"reviewers">,
							prUrl: prUrl.trim() || undefined,
						});
					} catch (err) {
						console.error("Failed to create active PR assignment row", err);
					}
				}
			}
			if (sendMessage && prUrl.trim() && nextReviewer && teamSlug) {
				try {
					const assignerName =
						user?.firstName && user?.lastName
							? `${user.firstName} ${user.lastName}`
							: user?.firstName || user?.lastName || "Unknown";
					const result = await sendGoogleChatAction({
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
					if (!result.success)
						console.error("Failed to send Google Chat message:", result.error);
				} catch (err) {
					console.error("Failed to send Google Chat message:", err);
				}
			}
		} finally {
			setTimeout(() => setIsAssigning(false), 600);
		}
	};

	const findNextAfterCurrent = (): Doc<"reviewers"> | null => {
		if (!nextReviewer || reviewers.length === 0) return null;
		const availableReviewers = reviewers.filter((r) => !r.isAbsent);
		if (availableReviewers.length === 0) return null;
		const minCount = Math.min(
			...availableReviewers.map((r) => r.assignmentCount),
		);
		const candidatesWithMin = availableReviewers.filter(
			(r) => r.assignmentCount === minCount && r._id !== nextReviewer._id,
		);
		if (candidatesWithMin.length > 0) {
			return (
				[...candidatesWithMin].sort((a, b) => a.createdAt - b.createdAt)[0] ||
				null
			);
		}
		const higher = availableReviewers.filter(
			(r) => r.assignmentCount > minCount,
		);
		if (!higher.length) return null;
		const nextMin = Math.min(...higher.map((r) => r.assignmentCount));
		const nextCandidates = availableReviewers.filter(
			(r) => r.assignmentCount === nextMin,
		);
		return (
			[...nextCandidates].sort((a, b) => a.createdAt - b.createdAt)[0] || null
		);
	};

	const lastAssignedReviewer = assignmentFeed.lastAssigned?.reviewerId
		? reviewers.find((r) => r._id === assignmentFeed.lastAssigned?.reviewerId)
		: null;
	const nextAfterCurrent = findNextAfterCurrent();

	return (
		<Card className="flex flex-col overflow-hidden">
			<CardHeader className="flex-shrink-0" />
			<CardContent className="flex-1 flex items-center justify-center">
				{nextReviewer ? (
					<div className="text-center py-8 w-full space-y-6 overflow-hidden">
						{lastAssignedReviewer && (
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
								<span className="inline-flex items-center gap-2  bg-primary/15 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25 dark:bg-white/12 dark:text-white dark:ring-white/20">
									<Sparkles className="h-3 w-3" />
									{t("pr.nextReviewer")}
								</span>
							</div>
							<div className="relative mx-auto max-w-xl overflow-hidden  bg-gradient-to-br from-primary/20 via-primary/16 to-primary/10 p-7 shadow-md ring-1 ring-primary/14 border border-white/6 dark:from-primary/28 dark:via-primary/32 dark:to-primary/20 dark:ring-primary/30 dark:border-white/5">
								<div
									className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.25),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.14),transparent_45%)] dark:bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.08),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.22),transparent_45%)]"
									aria-hidden
								/>
								<div className="relative space-y-1">
									<h3
										className={`text-4xl md:text-5xl font-bold text-primary dark:text-white drop-shadow-lg transition-all duration-300 ${
											isAssigning
												? "opacity-0 translate-y-1"
												: "opacity-100 translate-y-0"
										}`}
									>
										{nextReviewer.name}
									</h3>
								</div>
							</div>
						</div>

						{/* Auto-skip notification when current user is next */}
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

						{nextAfterCurrent && (
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
					<div className="text-center p-6 border-2 border-muted  bg-muted">
						<h3 className="text-xl font-medium text-muted-foreground mb-2">
							{t("pr.noAvailableReviewersTitle")}
						</h3>
						<p className="text-sm text-muted-foreground">
							{t("pr.allReviewersAbsent")}
						</p>
					</div>
				)}
			</CardContent>
			<CardFooter className="flex-shrink-0 space-y-6">
				<div className="w-full space-y-4">
					<ChatMessageCustomizer
						prUrl={prUrl}
						onPrUrlChange={setPrUrl}
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

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<Button
								onClick={handleAssignPR}
								disabled={
									!nextReviewer || isAssigning || (sendMessage && !prUrl.trim())
								}
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
