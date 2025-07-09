"use client";

import type { AssignmentFeed } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface SlotMachineHistoryProps {
	assignmentFeed: AssignmentFeed;
}

export function FeedHistory({ assignmentFeed }: SlotMachineHistoryProps) {
	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="flex-shrink-0">
				<CardTitle>Assignment History</CardTitle>
				<CardDescription>Recent PR review assignments</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 overflow-hidden">
				{assignmentFeed.items.length === 0 ? (
					<div className="text-center p-4 border rounded-lg bg-muted h-full flex items-center justify-center">
						<p>No recent assignments</p>
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
											by{" "}
											{`${item.actionBy.firstName} ${item.actionBy.lastName?.split(" ")[0]}` ||
												item.actionBy.email}
										</p>
									)}
								</div>
								<div>
									{item.forced && (
										<Badge
											variant="secondary"
											className="bg-amber-50 text-amber-700 border-amber-200"
										>
											Forced
										</Badge>
									)}
									{item.skipped && (
										<Badge
											variant="secondary"
											className="bg-blue-50 text-blue-700 border-blue-200"
										>
											Skipped
										</Badge>
									)}
									{!item.forced && !item.skipped && (
										<Badge
											variant="secondary"
											className="bg-green-50 text-green-700 border-green-200"
										>
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
