"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface AssignmentFeedItem {
	id: string;
	reviewerId: string;
	reviewerName: string;
	timestamp: number;
	isForced: boolean;
	wasSkipped: boolean;
	isAbsentSkip: boolean;
	actionBy?: {
		email: string;
		firstName?: string;
		lastName?: string;
	};
	tagId?: string;
}

interface AssignmentFeed {
	items: AssignmentFeedItem[];
	lastAssigned: string | null;
}

interface FeedHistoryProps {
	assignmentFeed: AssignmentFeed;
}

export function FeedHistory({ assignmentFeed }: FeedHistoryProps) {
	const t = useTranslations();

	// Use Convex for real-time tags
	const tags = useQuery(api.queries.getTags) || [];

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
				<CardDescription>{t("pr.recent")}</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 overflow-hidden">
				{assignmentFeed.items.length === 0 ? (
					<div className="text-center p-4 border rounded-lg bg-muted h-full flex items-center justify-center">
						<p>{t("pr.noAssignments")}</p>
					</div>
				) : (
					<div className="space-y-3 h-full overflow-y-auto">
						{assignmentFeed.items.map((item, index) => (
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
									{item.tagId && (
										<div className="mt-1">{getTagBadge(item.tagId)}</div>
									)}
								</div>
								<div className="flex flex-col items-end gap-1">
									{item.isForced && (
										<Badge className="bg-amber-50 text-amber-700 border-amber-200">
											Forced
										</Badge>
									)}
									{item.wasSkipped && (
										<Badge className="bg-blue-50 text-blue-700 border-blue-200">
											Skipped
										</Badge>
									)}
									{!item.isForced && !item.wasSkipped && (
										<Badge className="bg-green-50 text-green-700 border-green-200">
											Regular
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
