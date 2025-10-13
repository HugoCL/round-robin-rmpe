"use client";

import { useQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

export function FeedHistory({ teamSlug }: { teamSlug?: string }) {
	const t = useTranslations();

	// Use Convex for real-time tags and assignment history
	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") || [];
	const assignmentHistory =
		useQuery(
			api.queries.getAssignmentHistory,
			teamSlug ? { teamSlug } : "skip",
		) || [];

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
		<Card className="h-full flex flex-col">
			<CardHeader className="flex-shrink-0">
				<CardTitle>{t("history.title")}</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 overflow-hidden">
				{assignmentHistory.length === 0 ? (
					<div className="text-center p-4 border rounded-lg bg-muted h-full flex items-center justify-center">
						<p>{t("pr.noAssignments")}</p>
					</div>
				) : (
					<div className="space-y-3 h-full overflow-y-auto">
						{assignmentHistory.map((item, index) => (
							<div
								key={`${item.timestamp}-${item.reviewerName}-${index}`}
								className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
							>
								<div className="flex-1">
									<p className="font-semibold text-lg">{item.reviewerName}</p>
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
										</p>
									)}
									{item.tagId && (
										<div className="mt-1">{getTagBadge(item.tagId)}</div>
									)}
								</div>
								<div className="flex flex-col items-end gap-1">
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
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
