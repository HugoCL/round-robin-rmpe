"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Undo2, User } from "lucide-react"
import { type Reviewer, type AssignmentFeed } from "@/app/actions"

interface AssignmentCardProps {
    nextReviewer: Reviewer | null
    assignmentFeed: AssignmentFeed
    onAssignPR: () => Promise<void>
    onSkipReviewer: () => Promise<void>
    onUndoAssignment: () => Promise<void>
    onImTheNextOne: () => Promise<void>
}

export function AssignmentCard({
    nextReviewer,
    assignmentFeed,
    onAssignPR,
    onSkipReviewer,
    onUndoAssignment,
    onImTheNextOne,
}: AssignmentCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Assign PR Review</CardTitle>
                <CardDescription>Assign a PR to the next reviewer in rotation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {nextReviewer ? (
                    <div className="text-center p-4 border rounded-lg">
                        <h3 className="text-xl font-bold">{nextReviewer.name}</h3>
                        <p className="text-muted-foreground">Current assignments: {nextReviewer.assignmentCount}</p>
                    </div>
                ) : (
                    <div className="text-center p-4 border rounded-lg bg-muted">
                        <p>No available reviewers</p>
                    </div>
                )}

                {assignmentFeed.lastAssigned && (
                    <div className="text-center p-4 border rounded-lg bg-muted">
                        <p className="text-sm font-medium">Last assigned to:</p>
                        <p className="font-bold">{assignmentFeed.lastAssigned.reviewerName}</p>
                        <p className="text-xs text-muted-foreground">
                            {new Date(assignmentFeed.lastAssigned.timestamp).toLocaleString()}
                        </p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={onSkipReviewer} disabled={!nextReviewer}>
                    Skip
                </Button>
                <Button onClick={onAssignPR} disabled={!nextReviewer}>
                    Assign PR
                </Button>
            </CardFooter>
            <div className="px-6 pb-6 space-y-4">
                <Button variant="secondary" className="w-full" onClick={onUndoAssignment}>
                    <Undo2 className="h-4 w-4 mr-2" />
                    Undo Last Assignment
                </Button>

                <Button variant="outline" className="w-full" onClick={onImTheNextOne} disabled={!nextReviewer}>
                    <User className="h-4 w-4 mr-2" />
                    I'm the Next One
                </Button>
            </div>
        </Card>
    )
}
