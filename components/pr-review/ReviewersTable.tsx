"use client"

import type React from "react"
import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserMinus, Edit, Check, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { updateAssignmentCount, type Reviewer, type AssignmentFeed } from "@/app/actions"

interface ReviewersTableProps {
    reviewers: Reviewer[]
    nextReviewer: Reviewer | null
    assignmentFeed: AssignmentFeed
    showAssignments: boolean
    onRemoveReviewer: (id: string) => Promise<void>
    onToggleAbsence: (id: string) => Promise<void>
    onDataUpdate: () => Promise<void>
}

export function ReviewersTable({
    reviewers,
    nextReviewer,
    assignmentFeed,
    showAssignments,
    onRemoveReviewer,
    onToggleAbsence,
    onDataUpdate,
}: ReviewersTableProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<number>(0)

    const startEditing = (id: string, currentValue: number) => {
        setEditingId(id)
        setEditValue(currentValue)
    }

    const cancelEditing = () => {
        setEditingId(null)
    }

    const saveEditing = async () => {
        if (!editingId) return

        // Validate input
        if (editValue < 0 || isNaN(editValue)) {
            toast({
                title: "Invalid Value",
                description: "Assignment count must be a non-negative number",
                variant: "destructive",
            })
            return
        }

        // Update in Redis
        const success = await updateAssignmentCount(editingId, editValue)

        if (success) {
            // Refresh data to get updated reviewers
            await onDataUpdate()

            toast({
                title: "Assignment Count Updated",
                description: "The assignment count has been updated successfully",
            })

            // Exit edit mode
            setEditingId(null)
        } else {
            toast({
                title: "Error",
                description: "Failed to update assignment count. Please try again.",
                variant: "destructive",
            })
        }
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    {showAssignments && <TableHead>Assignments</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {reviewers.map((reviewer) => (
                    <TableRow key={reviewer.id} className={reviewer.isAbsent ? "opacity-60" : ""}>
                        <TableCell className="font-medium">
                            {reviewer.name}
                            {nextReviewer?.id === reviewer.id && <Badge className="ml-2 bg-green-500 text-white">Next</Badge>}
                            {assignmentFeed.lastAssigned?.reviewerId === reviewer.id && (
                                <Badge className="ml-2 bg-blue-500 text-white">Last Assigned</Badge>
                            )}
                        </TableCell>
                        {showAssignments && (
                            <TableCell>
                                {editingId === reviewer.id ? (
                                    <div className="flex items-center space-x-2">
                                        <Input
                                            type="number"
                                            value={editValue}
                                            onChange={(e) => setEditValue(Number.parseInt(e.target.value) || 0)}
                                            className="w-20"
                                            min={0}
                                        />
                                        <Button size="icon" variant="ghost" onClick={saveEditing}>
                                            <Check className="h-4 w-4 text-green-500" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={cancelEditing}>
                                            <X className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <span>{reviewer.assignmentCount}</span>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => startEditing(reviewer.id, reviewer.assignmentCount)}
                                        >
                                            <Edit className="h-3 w-3 text-muted-foreground" />
                                        </Button>
                                    </div>
                                )}
                            </TableCell>
                        )}
                        <TableCell>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id={`absence-${reviewer.id}`}
                                    checked={!reviewer.isAbsent}
                                    onCheckedChange={() => onToggleAbsence(reviewer.id)}
                                />
                                <Label htmlFor={`absence-${reviewer.id}`}>{reviewer.isAbsent ? "Absent" : "Available"}</Label>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => onRemoveReviewer(reviewer.id)}>
                                <UserMinus className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
