"use client";

import { Undo2, User } from "lucide-react";
import type { Reviewer } from "@/app/actions";
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
	onAssignPR: () => Promise<void>;
	onUndoAssignment: () => Promise<void>;
	onImTheNextOne: () => Promise<void>;
}

export function AssignmentCard({
	nextReviewer,
	onAssignPR,
	onUndoAssignment,
	onImTheNextOne,
}: AssignmentCardProps) {
	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="flex-shrink-0">
				<CardTitle>Assign PR Review</CardTitle>
				<CardDescription>
					Assign a PR to the next reviewer in rotation
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 flex items-center justify-center space-y-6">
				{nextReviewer ? (
					<div className="text-center py-8">
						<div className="mb-4">
							<span className="text-sm font-medium text-primary uppercase tracking-wide">
								Next Reviewer
							</span>
						</div>
						<h3 className="text-5xl font-bold text-primary">
							{nextReviewer.name}
						</h3>
					</div>
				) : (
					<div className="text-center p-6 border-2 border-muted rounded-lg bg-muted">
						<h3 className="text-xl font-medium text-muted-foreground mb-2">
							No Available Reviewers
						</h3>
						<p className="text-sm text-muted-foreground">
							All reviewers are currently absent
						</p>
					</div>
				)}
			</CardContent>
			<CardFooter className="flex justify-center flex-shrink-0">
				<Button
					onClick={onAssignPR}
					disabled={!nextReviewer}
					className="flex-1 bg-primary hover:bg-primary/90 max-w-md"
					size="lg"
				>
					Assign PR
				</Button>
			</CardFooter>
			<div className="px-6 pb-6 space-y-3 flex-shrink-0">
				<div className="flex gap-3">
					<Button
						variant="secondary"
						className="flex-1"
						onClick={onUndoAssignment}
					>
						<Undo2 className="h-4 w-4 mr-2" />
						Undo Last Assignment
					</Button>

					<Button
						variant="outline"
						className="flex-1"
						onClick={onImTheNextOne}
						disabled={!nextReviewer}
					>
						<User className="h-4 w-4 mr-2" />
						I'm the Next One
					</Button>
				</div>
			</div>
		</Card>
	);
}
