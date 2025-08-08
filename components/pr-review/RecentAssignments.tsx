"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";

// Types
interface AssignmentHistoryItem {
	reviewerId: string;
	reviewerName: string;
	timestamp: number;
	forced: boolean;
	skipped: boolean;
	isAbsentSkip: boolean;
	tagId?: string;
	actionBy?: {
		email: string;
		firstName?: string;
		lastName?: string;
	};
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
					<div className="text-center p-4 border rounded-lg bg-muted">
						<p>{t("pr.noAssignments")}</p>
					</div>
				) : (
					<div className="space-y-3">
						{assignmentHistory.map(
							(item: AssignmentHistoryItem, index: number) => (
								<div
									key={`${item.reviewerName}-${item.timestamp}-${index}`}
									className="flex items-center p-3 border rounded-lg"
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
									</div>
									<div>
										{item.forced && (
											<Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:border-transparent hover:text-white">
												{t("pr.forceAssign")}
											</Badge>
										)}
										{item.skipped && (
											<Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:border-transparent hover:text-white">
												{t("pr.skip")}
											</Badge>
										)}
										{!item.forced && !item.skipped && (
											<Badge className="bg-green-50 text-green-700 border-green-200 hover:border-transparent hover:text-white">
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
