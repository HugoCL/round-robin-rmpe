"use client";

import { useQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { GroupedAssignmentHistoryItem } from "@/lib/types";
import { usePRReview } from "./PRReviewContext";

export function FeedHistory({ teamSlug }: { teamSlug?: string }) {
	const t = useTranslations();
	const { userInfo, reviewers, myAssignmentsOnly, toggleMyAssignmentsOnly } =
		usePRReview();

	// Use Convex for real-time tags and assignment history
	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") || [];
	const assignmentHistory: GroupedAssignmentHistoryItem[] =
		useQuery(
			api.queries.getAssignmentHistory,
			teamSlug ? { teamSlug } : "skip",
		) || [];

	const filteredAssignmentHistory = useMemo(() => {
		if (!myAssignmentsOnly) return assignmentHistory;
		const userEmail = userInfo?.email?.toLowerCase().trim();
		if (!userEmail) return assignmentHistory;

		const myReviewerIds = new Set(
			reviewers
				.filter((reviewer) => reviewer.email.toLowerCase().trim() === userEmail)
				.map((reviewer) => String(reviewer._id)),
		);

		return assignmentHistory.filter((item) => {
			const assignedForMe = item.reviewers.some((reviewer) =>
				myReviewerIds.has(reviewer.reviewerId),
			);
			const assignedByMe =
				(item.actionByReviewerId
					? myReviewerIds.has(item.actionByReviewerId)
					: false) ||
				(item.actionByEmail
					? item.actionByEmail.toLowerCase().trim() === userEmail
					: false);

			return assignedForMe || assignedByMe;
		});
	}, [assignmentHistory, myAssignmentsOnly, reviewers, userInfo?.email]);

	const getTagBadge = (tagId: string) => {
		const tag = tags.find((t: Doc<"tags">) => t._id === tagId);
		if (!tag) return null;

		return (
			<Badge
				variant="secondary"
				className="text-xs"
				style={{
					backgroundColor: `${tag.color}20`,
					color: tag.color,
					borderColor: tag.color,
				}}
			>
				{tag.name}
			</Badge>
		);
	};

	return (
		<Card>
			<CardHeader className="shrink-0 flex flex-row items-start justify-between gap-4">
				<CardTitle className="mt-1">{t("history.title")}</CardTitle>
				<div className="flex items-center gap-2">
					<label
						htmlFor="history-my-assignments-toggle"
						className="text-xs text-muted-foreground whitespace-nowrap"
					>
						{t("history.myAssignmentsOnlyLabel")}
					</label>
					<Switch
						id="history-my-assignments-toggle"
						checked={myAssignmentsOnly}
						onCheckedChange={(checked) => {
							if (checked !== myAssignmentsOnly) {
								toggleMyAssignmentsOnly();
							}
						}}
					/>
				</div>
			</CardHeader>
			<CardContent>
				{filteredAssignmentHistory.length === 0 ? (
					<div className="text-center p-4 border  bg-muted h-full flex items-center justify-center">
						<p>{t("pr.noAssignments")}</p>
					</div>
				) : (
					<div className="space-y-3">
						{filteredAssignmentHistory.slice(0, 6).map((item) => (
							<div
								key={item.id}
								className={`flex items-start justify-between p-3 border hover:bg-muted/50 transition-colors ${
									item.urgent ? "urgent-card" : ""
								}`}
							>
								<div className="flex-1">
									<p className="font-semibold text-lg">
										{item.reviewerCount === 1
											? item.reviewers[0]?.reviewerName
											: t("history.assigneesCount", {
													count: item.reviewerCount,
												})}
									</p>
									{item.reviewerCount > 1 && (
										<div className="mt-2 flex flex-wrap gap-2">
											{item.reviewers.map((reviewer) => (
												<div
													key={`${reviewer.reviewerId}-${reviewer.timestamp}`}
													className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs"
												>
													<span className="font-medium">
														{reviewer.reviewerName}
													</span>
													{reviewer.tagId && getTagBadge(reviewer.tagId)}
												</div>
											))}
										</div>
									)}
									<p className="mt-2 text-xs text-muted-foreground">
										{new Date(item.timestamp).toLocaleString()}
									</p>
									{(item.actionByName || item.actionByEmail) && (
										<p className="text-xs text-muted-foreground mt-1">
											{t("history.assignedBy")}:{" "}
											{item.actionByName || item.actionByEmail}
										</p>
									)}
									{item.prUrl && (
										<p className="text-xs mt-1 flex gap-2 flex-wrap">
											<Link
												href={item.prUrl}
												target="_blank"
												rel="noreferrer noopener"
												aria-label={t("common.viewPR")}
												className="inline-flex items-center gap-1"
											>
												<Badge
													variant="outline"
													className="cursor-pointer hover:bg-primary/10 transition-colors"
												>
													{t("common.viewPR")}
													<ExternalLink className="h-3 w-3 ml-1" />
												</Badge>
											</Link>
											{item.contextUrl && (
												<Link
													href={item.contextUrl}
													target="_blank"
													rel="noreferrer noopener"
													aria-label={t("common.viewContext")}
													className="inline-flex items-center gap-1"
												>
													<Badge
														variant="outline"
														className="cursor-pointer hover:bg-primary/10 transition-colors"
													>
														{t("common.viewContext")}
														<ExternalLink className="h-3 w-3 ml-1" />
													</Badge>
												</Link>
											)}
											{item.googleChatThreadUrl && (
												<Link
													href={item.googleChatThreadUrl}
													target="_blank"
													rel="noreferrer noopener"
													aria-label={t("common.viewChatThread")}
													className="inline-flex items-center gap-1"
												>
													<Badge
														variant="outline"
														className="cursor-pointer hover:bg-primary/10 transition-colors"
													>
														{t("common.viewChatThread")}
														<ExternalLink className="h-3 w-3 ml-1" />
													</Badge>
												</Link>
											)}
										</p>
									)}
									{item.reviewerCount === 1 && item.reviewers[0]?.tagId ? (
										<div className="mt-1">
											{getTagBadge(item.reviewers[0].tagId)}
										</div>
									) : null}
								</div>
								<div className="flex flex-col items-end gap-1">
									{item.urgent && (
										<Badge className="bg-red-50 text-red-700 border-red-200 hover:border-transparent hover:bg-red-100 transition-colors dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60">
											{t("pr.urgent")}
										</Badge>
									)}
									{item.crossTeamReview && (
										<Badge className="border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:border-transparent hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
											{t("pr.crossTeamReview")}
										</Badge>
									)}
									{item.forced && (
										<Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:border-transparent hover:bg-amber-100 transition-colors">
											{t("pr.forceAssign")}
										</Badge>
									)}
									{(item.skipped || item.isAbsentSkip) && (
										<Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:border-transparent hover:bg-blue-100 transition-colors">
											{t("pr.skip")}
										</Badge>
									)}
									{!item.urgent &&
										!item.crossTeamReview &&
										!item.forced &&
										!item.skipped &&
										!item.isAbsentSkip && (
											<Badge className="bg-green-50 text-green-700 border-green-200 hover:border-transparent hover:bg-green-100 transition-colors">
												{t("pr.regular")}
											</Badge>
										)}
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
