"use client";

import { useQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { GroupedAssignmentHistoryItem } from "@/lib/types";

export function RecentAssignments({ teamSlug }: { teamSlug?: string }) {
	const t = useTranslations();
	// Use Convex for real-time assignment history
	const assignmentHistory: GroupedAssignmentHistoryItem[] =
		useQuery(
			api.queries.getAssignmentHistory,
			teamSlug ? { teamSlug } : "skip",
		) || [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("pr.recent")}</CardTitle>
			</CardHeader>
			<CardContent>
				{assignmentHistory.length === 0 ? (
					<div className="text-center p-4 border  bg-muted/50">
						<p>{t("pr.noAssignments")}</p>
					</div>
				) : (
					<div className="space-y-3">
						{assignmentHistory.map((item) => (
							<div
								key={item.id}
								className="flex items-start p-3 border  bg-card/50"
							>
								<div className="flex-1">
									<p className="font-medium">
										{item.reviewerCount === 1
											? item.reviewers[0]?.reviewerName
											: t("history.assigneesCount", {
													count: item.reviewerCount,
												})}
									</p>
									{item.reviewerCount > 1 && (
										<p className="mt-1 text-sm font-medium text-foreground">
											{item.reviewers
												.map((reviewer) => reviewer.reviewerName)
												.join(", ")}
										</p>
									)}
									<p className="text-xs text-muted-foreground">
										{new Date(item.timestamp).toLocaleString()}
									</p>
									{(item.actionByName || item.actionByEmail) && (
										<p className="text-xs text-muted-foreground mt-1">
											{t("history.assignedBy")}:{" "}
											{item.actionByName || item.actionByEmail}
										</p>
									)}
									{item.prUrl && (
										<p className="text-xs mt-1">
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
										</p>
									)}
									{item.reviewerCount > 1 && (
										<div className="mt-2 flex flex-wrap gap-2">
											{item.reviewers.map((reviewer) => (
												<Badge
													key={`${reviewer.reviewerId}-${reviewer.timestamp}`}
													variant="secondary"
													className="text-xs"
												>
													{reviewer.reviewerName}
												</Badge>
											))}
										</div>
									)}
								</div>
								<div>
									{item.forced && (
										<Badge
											variant="primarySoft"
											className="text-amber-700 border-amber-200 bg-amber-50"
										>
											{t("pr.forceAssign")}
										</Badge>
									)}
									{(item.skipped || item.isAbsentSkip) && (
										<Badge
											variant="primarySoft"
											className="text-blue-700 border-blue-200 bg-blue-50"
										>
											{t("pr.skip")}
										</Badge>
									)}
									{!item.forced && !item.skipped && !item.isAbsentSkip && (
										<Badge
											variant="primarySoft"
											className="text-green-700 border-green-200 bg-green-50"
										>
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
