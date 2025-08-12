"use client";

import { Undo2, User, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { usePRReview } from "./PRReviewContext";

export function AssignmentCard() {
	const t = useTranslations();
	const locale = useLocale();
	const {
		nextReviewer,
		reviewers,
		assignmentFeed,
		assignPR: onAssignPR,
		undoAssignment: onUndoAssignment,
		handleImTheNextOneWithDialog: onImTheNextOne,
		userInfo: user,
	} = usePRReview();
	const [isAssigning, setIsAssigning] = useState(false);
	const [previousNextReviewer, setPreviousNextReviewer] =
		useState<Doc<"reviewers"> | null>(null);

	const [sendMessage, setSendMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");

	// Use Convex action for Google Chat
	const sendGoogleChatAction = useAction(api.actions.sendGoogleChatMessage);

	// Track changes in nextReviewer to trigger animations
	useEffect(() => {
		if (nextReviewer?._id !== previousNextReviewer?._id) {
			setPreviousNextReviewer(nextReviewer);
		}
	}, [nextReviewer, previousNextReviewer]);

	// Wrapper function to handle assignment with animation
	const handleAssignPR = async () => {
		setIsAssigning(true);
		try {
			await onAssignPR();
			// Send message to Google Chat if enabled
			if (sendMessage && prUrl.trim() && nextReviewer) {
				try {
					const assignerName =
						user?.firstName && user?.lastName
							? `${user.firstName} ${user.lastName}`
							: user?.firstName || user?.lastName || "Unknown";

					const result = await sendGoogleChatAction({
						reviewerName: nextReviewer.name,
						reviewerEmail: nextReviewer.email,
						prUrl,
						locale,
						assignerEmail: user?.email,
						assignerName,
						sendOnlyNames: true,
					});
					if (!result.success) {
						console.error("Failed to send Google Chat message:", result.error);
					}
				} catch (error) {
					console.error("Failed to send Google Chat message:", error);
				}
			}
		} finally {
			setTimeout(() => setIsAssigning(false), 600);
		}
	};

	// Helper function to find the next reviewer after the current next one
	const findNextAfterCurrent = (): Doc<"reviewers"> | null => {
		if (!nextReviewer || reviewers.length === 0) return null;

		// Find the minimum assignment count among all non-absent reviewers
		const availableReviewers = reviewers.filter((r) => !r.isAbsent);
		if (availableReviewers.length === 0) return null;

		// Find all reviewers with the minimum count, excluding the current next reviewer
		const minCount = Math.min(
			...availableReviewers.map((r) => r.assignmentCount),
		);
		const candidatesWithMinCount = availableReviewers.filter(
			(r) => r.assignmentCount === minCount && r._id !== nextReviewer._id,
		);

		// If there are candidates with the same count, sort by creation time
		if (candidatesWithMinCount.length > 0) {
			const sortedCandidates = [...candidatesWithMinCount].sort(
				(a, b) => a.createdAt - b.createdAt,
			);
			return sortedCandidates[0] || null;
		}

		// If the current next reviewer has the minimum count, find the next lowest
		const nextMinCount = Math.min(
			...availableReviewers
				.filter((r) => r.assignmentCount > minCount)
				.map((r) => r.assignmentCount),
		);

		if (nextMinCount !== Infinity) {
			const nextCandidates = availableReviewers.filter(
				(r) => r.assignmentCount === nextMinCount,
			);
			const sortedNextCandidates = [...nextCandidates].sort(
				(a, b) => a.createdAt - b.createdAt,
			);
			return sortedNextCandidates[0] || null;
		}

		return null;
	};

	// Get the last assigned reviewer (optional chaining avoids non-null assertions)
	const lastAssignedReviewer = assignmentFeed.lastAssigned?.reviewerId
		? reviewers.find((r) => r._id === assignmentFeed.lastAssigned?.reviewerId)
		: null;

	// Get the next reviewer after current
	const nextAfterCurrent = findNextAfterCurrent();

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="flex-shrink-0">
				<div className="flex justify-between items-end">
					{/* Google Chat Toggle */}
					<div className="flex items-center space-x-2">
						<MessageSquare className="h-4 w-4 text-green-600" />
						<Switch
							id="send-message"
							checked={sendMessage}
							onCheckedChange={setSendMessage}
							className="data-[state=checked]:bg-green-600"
						/>
					</div>
				</div>
			</CardHeader>
			<CardContent className="flex-1 flex items-center justify-center">
				{nextReviewer ? (
					<div className="text-center py-8 w-full space-y-6 overflow-hidden">
						{/* Last assigned reviewer (greyed out) */}
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

						{/* Current next reviewer */}
						<div
							className={`transition-transform duration-500 ease-in-out ${
								isAssigning ? "-translate-y-12" : "translate-y-0"
							}`}
						>
							<div className="mb-4">
								<span className="text-sm font-medium text-primary uppercase tracking-wide">
									{t("pr.nextReviewer")}
								</span>
							</div>
							<h3 className="text-5xl font-bold text-primary">
								{nextReviewer.name}
							</h3>
						</div>

						{/* Next after current (upcoming) */}
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
				{/* Action Buttons Section */}
				<div className="w-full space-y-4">
					{/* PR URL Input Section - Only shown when Google Chat is enabled */}
					{sendMessage && (
						<div className="w-full mb-6">
							<div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-muted/50">
								<div className="space-y-1">
									<Label
										htmlFor="pr-url"
										className="text-xs text-muted-foreground"
									>
										PR URL
									</Label>
									<Input
										id="pr-url"
										placeholder="https://github.com/owner/repo/pull/123"
										value={prUrl}
										onChange={(e) => setPrUrl(e.target.value)}
										className="text-sm"
									/>
								</div>
							</div>
						</div>
					)}
					<div className="flex justify-center">
						<Button
							onClick={handleAssignPR}
							disabled={
								!nextReviewer || isAssigning || (sendMessage && !prUrl.trim())
							}
							className="flex-1 bg-primary hover:bg-primary/90 max-w-md"
							size="lg"
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
