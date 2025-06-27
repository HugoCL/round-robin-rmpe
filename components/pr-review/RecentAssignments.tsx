"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { type AssignmentFeed } from "@/app/actions"

interface RecentAssignmentsProps {
    assignmentFeed: AssignmentFeed
}

export function RecentAssignments({ assignmentFeed }: RecentAssignmentsProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Assignments</CardTitle>
                <CardDescription>Last 5 PR review assignments</CardDescription>
            </CardHeader>
            <CardContent>
                {assignmentFeed.items.length === 0 ? (
                    <div className="text-center p-4 border rounded-lg bg-muted">
                        <p>No recent assignments</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {assignmentFeed.items.map((item, index) => (
                            <div key={index} className="flex items-center p-3 border rounded-lg">
                                <div className="flex-1">
                                    <p className="font-medium">{item.reviewerName}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</p>
                                </div>
                                <div>
                                    {item.forced && (
                                        <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                                            Forced
                                        </Badge>
                                    )}
                                    {item.skipped && (
                                        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                                            Skipped
                                        </Badge>
                                    )}
                                    {!item.forced && !item.skipped && (
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
    )
}
