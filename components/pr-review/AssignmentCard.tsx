"use client";

import { useAction } from "convex/react";
import { Lightbulb, Undo2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
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
		handleImTheNextOneWithDialog: onImTheNextOne,
		userInfo: user,
	} = usePRReview();

	const [isAssigning, setIsAssigning] = useState(false);
	const [sendMessage, setSendMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [customMessage, setCustomMessage] = useState("");
	const [enableCustomMessage, setEnableCustomMessage] = useState(false);

	const sendGoogleChatAction = useAction(api.actions.sendGoogleChatMessage);

	const handleAssignPR = async () => {
		setIsAssigning(true);
		try {
			await onAssignPR({ prUrl: prUrl.trim() || undefined });
			if (sendMessage && prUrl.trim() && nextReviewer) {
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
						locale: "es",
						assignerEmail: user?.email,
						assignerName,
						teamSlug: teamSlug || undefined,
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
	const isCurrentUserNext =
		!!user?.email &&
		!!nextReviewer?.email &&
		user.email.toLowerCase() === nextReviewer.email.toLowerCase();

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="flex-shrink-0" />
			<CardContent className="flex-1 flex items-center justify-center">
				{nextReviewer ? (
					<div className="text-center py-8 w-full space-y-6 overflow-hidden">
						{lastAssignedReviewer && (
							<div
								className={`transition-transform duration-500 ease-in-out ${
									isAssigning
										? "-translate-y-24 opacity-0"
										: "translate-y-0 opacity-100"
								}`}
							>
								<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									{t("pr.lastAssigned")}
								</span>
								<h4 className="text-lg font-medium text-muted-foreground opacity-60">
									{lastAssignedReviewer.name}
								</h4>
							</div>
						)}

						<div
							className={`transition-transform duration-500 ease-in-out ${
								isAssigning ? "-translate-y-12" : "translate-y-0"
							}`}
						>
							<div className="mb-2">
								<span className="text-xs font-medium text-primary uppercase tracking-wide">
									{t("pr.nextReviewer")}
								</span>
							</div>
							<h3 className="text-4xl md:text-5xl font-bold text-primary">
								{nextReviewer.name}
							</h3>
						</div>

						{isCurrentUserNext && (
							<div className="flex justify-center mt-2">
								<Alert className="max-w-xl w-full bg-background">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-2">
											<Lightbulb className="h-4 w-4 text-muted-foreground" />
											<span className="text-sm leading-5">
												{t("pr.youAreNext")}
											</span>
										</div>
										<Button
											size="sm"
											variant="outline"
											className="whitespace-nowrap"
											onClick={onImTheNextOne}
										>
											{t("pr.suggestImTheNext")}
										</Button>
									</div>
								</Alert>
							</div>
						)}

						{nextAfterCurrent && (
							<div
								className={`transition-transform duration-500 ease-in-out ${
									isAssigning ? "-translate-y-12" : "translate-y-0"
								}`}
							>
								<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									{t("pr.upNext")}
								</span>
								<h4 className="text-lg font-medium text-muted-foreground">
									{nextAfterCurrent.name}
								</h4>
							</div>
						)}
					</div>
				) : (
					<div className="text-center p-6 border-2 border-muted rounded-lg bg-muted">
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

					<div className="flex justify-center">
						<Button
							onClick={handleAssignPR}
							disabled={
								!nextReviewer || isAssigning || (sendMessage && !prUrl.trim())
							}
							className="flex-1 max-w-md"
							size="lg"
							variant="primary"
							shape="pill"
						>
							{isAssigning ? t("tags.assigning") : t("pr.assignPR")}
						</Button>
					</div>

					<div className="flex flex-col gap-3">
						<Button
							variant="secondary"
							className="w-full"
							onClick={onUndoAssignment}
							disabled={isAssigning}
						>
							<Undo2 className="h-4 w-4 mr-2" />
							{t("pr.undoLastAssignment")}
						</Button>
						<Button
							variant="outline"
							className="w-full"
							onClick={onImTheNextOne}
							disabled={!nextReviewer || isAssigning}
						>
							<User className="h-4 w-4 mr-2" />
							{t("pr.imTheNextOne")}
						</Button>
					</div>
				</div>
			</CardFooter>
		</Card>
	);
}
