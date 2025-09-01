"use client";

import { useQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

export function RecentAssignments({ teamSlug }: { teamSlug?: string }) {
	const t = useTranslations();
	// Use Convex for real-time assignment history
	const assignmentHistory =
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
					<div className="text-center p-4 border rounded-lg bg-muted/50">
						<p>{t("pr.noAssignments")}</p>
					</div>
				) : (
					<div className="space-y-3">
						{assignmentHistory.map(
							(item: Doc<"assignmentHistory">, index: number) => (
								<div
									key={`${item.reviewerName}-${item.timestamp}-${index}`}
									className="flex items-center p-3 border rounded-lg bg-card/50"
								>
									<div className="flex-1">
										<p className="font-medium">{item.reviewerName}</p>
										<p className="text-xs text-muted-foreground">
											{new Date(item.timestamp).toLocaleString()}
										</p>
										{item.actionBy && (
											<p className="text-xs text-muted-foreground mt-1">
												{t("history.assignedBy")}:{" "}
												{[
													item.actionBy.firstName,
													item.actionBy.lastName?.split(" ")[0],
												]
													.filter(Boolean)
													.join(" ") || item.actionBy.email}
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
										{item.skipped && (
											<Badge
												variant="primarySoft"
												className="text-blue-700 border-blue-200 bg-blue-50"
											>
												{t("pr.skip")}
											</Badge>
										)}
										{!item.forced && !item.skipped && (
											<Badge
												variant="primarySoft"
												className="text-green-700 border-green-200 bg-green-50"
											>
												{t("pr.regular")}
											</Badge>
										)}
									</div>
								</div>
							),
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
