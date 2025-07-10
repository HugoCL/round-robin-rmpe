"use client";

import { Undo2, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { Reviewer, AssignmentFeed } from "@/app/[locale]/actions";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface AssignmentCardProps {
	nextReviewer: Reviewer | null;
	reviewers: Reviewer[];
	assignmentFeed: AssignmentFeed;
	onAssignPR: () => Promise<void>;
	onUndoAssignment: () => Promise<void>;
	onImTheNextOne: () => Promise<void>;
}

export function AssignmentCard({
	nextReviewer,
	reviewers,
	assignmentFeed,
	onAssignPR,
	onUndoAssignment,
	onImTheNextOne,
}: AssignmentCardProps) {
	const t = useTranslations();
	const [isAssigning, setIsAssigning] = useState(false);
	const [previousNextReviewer, setPreviousNextReviewer] =
		useState<Reviewer | null>(null);

	// Track changes in nextReviewer to trigger animations
	useEffect(() => {
		if (nextReviewer?.id !== previousNextReviewer?.id) {
			setPreviousNextReviewer(nextReviewer);
		}
	}, [nextReviewer, previousNextReviewer]);

	// Wrapper function to handle assignment with animation
	const handleAssignPR = async () => {
		setIsAssigning(true);
		try {
			await onAssignPR();
		} finally {
			// Wait for the animation to complete before resetting
			setTimeout(() => setIsAssigning(false), 600);
		}
	};

	// Helper function to find the next reviewer after the current next one
	const findNextAfterCurrent = (): Reviewer | null => {
		if (!nextReviewer || reviewers.length === 0) return null;

		// Find the minimum assignment count among all non-absent reviewers
		const availableReviewers = reviewers.filter((r) => !r.isAbsent);
		if (availableReviewers.length === 0) return null;

		// Find all reviewers with the minimum count, excluding the current next reviewer
		const minCount = Math.min(
			...availableReviewers.map((r) => r.assignmentCount),
		);
		const candidatesWithMinCount = availableReviewers.filter(
			(r) => r.assignmentCount === minCount && r.id !== nextReviewer.id,
		);

		// If there are candidates with the same count, sort by creation time
		if (candidatesWithMinCount.length > 0) {
			const sortedCandidates = [...candidatesWithMinCount].sort(
				(a, b) => a.createdAt - b.createdAt,
			);
			return sortedCandidates[0];
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
			return sortedNextCandidates[0];
		}

		return null;
	};

	// Get the last assigned reviewer
	const lastAssignedReviewer = assignmentFeed.lastAssigned
		? reviewers.find((r) => r.id === assignmentFeed.lastAssigned?.reviewerId)
		: null;

	// Get the next reviewer after current
	const nextAfterCurrent = findNextAfterCurrent();

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="flex-shrink-0">
				<CardTitle>{t("pr.assignPR")}</CardTitle>
				<CardDescription>{t("pr.assignReviewer")}</CardDescription>
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
			<CardFooter className="flex-shrink-0 space-y-4">
				<div className="w-full space-y-4">
					<div className="flex justify-center">
						<Button
							onClick={handleAssignPR}
							disabled={!nextReviewer || isAssigning}
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
