"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
    UserPlus,
    RotateCw,
    Save,
    Download,
    Eye,
    EyeOff,
    RefreshCw,
    MoreHorizontal,
    Clock,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { signOutAuthKit } from "@/app/actions"
import { getSnapshots, restoreFromSnapshot, type BackupEntry } from "@/app/backup-actions"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@workos-inc/authkit-nextjs/components"
import { usePRReviewData } from "@/hooks/usePRReviewData"
import { ReviewersTable } from "@/components/pr-review/ReviewersTable"
import { AssignmentCard } from "@/components/pr-review/AssignmentCard"
import { RecentAssignments } from "@/components/pr-review/RecentAssignments"
import { ForceAssignDialog } from "@/components/pr-review/ForceAssignDialog"
import { SkipConfirmationDialog } from "@/components/pr-review/SkipConfirmationDialog"

export default function PRReviewAssignment() {
    const [newReviewerName, setNewReviewerName] = useState("")
    const [snapshots, setSnapshots] = useState<BackupEntry[]>([])
    const [snapshotsLoading, setSnapshotsLoading] = useState(false)
    const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
    const [showAssignments, setShowAssignments] = useState(false)
    const [skipConfirmDialogOpen, setSkipConfirmDialogOpen] = useState(false)
    const [nextAfterSkip, setNextAfterSkip] = useState<any>(null)

    const { user, loading } = useAuth()
    
    const {
        reviewers,
        nextReviewer,
        isLoading,
        isRefreshing,
        assignmentFeed,
        assignPR,
        skipReviewer,
        handleImTheNextOne,
        confirmSkipToNext,
        undoAssignment,
        addReviewer,
        removeReviewer,
        handleToggleAbsence,
        handleResetCounts,
        exportData,
        importData,
        fetchData,
        handleManualRefresh,
        formatLastUpdated,
    } = usePRReviewData()

    // Load show assignments preference from localStorage
    useEffect(() => {
        const savedShowAssignments = localStorage.getItem("showAssignments")
        if (savedShowAssignments !== null) {
            setShowAssignments(savedShowAssignments === "true")
        }
    }, [])

    // Save show assignments preference to localStorage
    useEffect(() => {
        localStorage.setItem("showAssignments", showAssignments.toString())
    }, [showAssignments])

    const handleAddReviewer = async () => {
        const success = await addReviewer(newReviewerName)
        if (success) {
            setNewReviewerName("")
        }
    }

    const handleImTheNextOneWithDialog = async () => {
        const result = await handleImTheNextOne()
        if (result.success && result.nextReviewer) {
            setNextAfterSkip(result.nextReviewer)
            setSkipConfirmDialogOpen(true)
        }
    }

    const handleConfirmSkipToNext = async () => {
        if (!nextReviewer || !nextAfterSkip) return

        await confirmSkipToNext(nextReviewer, nextAfterSkip)
        
        // Close the dialog
        setSkipConfirmDialogOpen(false)
        setNextAfterSkip(null)
    }

    const handleCancelSkip = () => {
        setSkipConfirmDialogOpen(false)
        setNextAfterSkip(null)
    }

    const importFileHandler = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        await importData(file)
        
        // Reset the input
        event.target.value = ""
    }

    const loadSnapshots = async () => {
        setSnapshotsLoading(true)
        try {
            const snapshotData = await getSnapshots()
            setSnapshots(snapshotData)
        } catch (error) {
            console.error("Error loading snapshots:", error)
            toast({
                title: "Error",
                description: "Failed to load snapshots",
                variant: "destructive",
            })
        } finally {
            setSnapshotsLoading(false)
        }
    }

    const handleOpenSnapshotDialog = () => {
        loadSnapshots()
        setSnapshotDialogOpen(true)
    }

    const handleRestoreSnapshot = async (key: string) => {
        try {
            const success = await restoreFromSnapshot(key)

            if (success) {
                // Refresh data after restore
                await fetchData()

                toast({
                    title: "Snapshot Restored",
                    description: "The selected snapshot has been successfully restored",
                })
                setSnapshotDialogOpen(false)
            } else {
                toast({
                    title: "Error",
                    description: "Failed to restore from snapshot",
                    variant: "destructive",
                })
            }
        } catch (error) {
            console.error("Error restoring snapshot:", error)
            toast({
                title: "Error",
                description: "Failed to restore from snapshot",
                variant: "destructive",
            })
        }
    }

    const toggleShowAssignments = () => {
        setShowAssignments((prev) => !prev)
    }

    if (isLoading || loading) {
        return (
            <div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Loading...</h2>
                    <p className="text-muted-foreground">Fetching reviewer data from database</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">You are not authenticated</h2>
                    <p className="text-muted-foreground">Please sign in to access this page</p>
                </div>
            </div>
        )
    }

    if (user && (!user.email.endsWith("@buk.cl") && !user.email.endsWith("@buk.pe"))) {
        return (
            <div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">You are not authorized</h2>
                    <p className="text-muted-foreground">
                        Please sign in with a valid email address. You're currently using {user.email}
                    </p>
                    <form
                        action={async () => {
                            await signOutAuthKit()
                        }}
                    >
                        <Button type="submit">Sign out</Button>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h1 className="text-3xl font-bold">PR Review - Remuneraciones Perú</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={toggleShowAssignments}>
                        {showAssignments ? (
                            <>
                                <EyeOff className="h-4 w-4" />
                                <span className="hidden sm:inline">Hide Assignments</span>
                            </>
                        ) : (
                            <>
                                <Eye className="h-4 w-4" />
                                <span className="hidden sm:inline">Show Assignments</span>
                            </>
                        )}
                    </Button>

                    <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={handleOpenSnapshotDialog}>
                        <Clock className="h-4 w-4" />
                        <span className="hidden sm:inline">History</span>
                    </Button>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={handleManualRefresh}
                                    disabled={isRefreshing}
                                >
                                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                                    <span className="hidden sm:inline">Refresh</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Last updated: {formatLastUpdated()}</p>
                                <p className="text-xs text-muted-foreground">Updates automatically every minute</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Reviewers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReviewersTable
                            reviewers={reviewers}
                            nextReviewer={nextReviewer}
                            assignmentFeed={assignmentFeed}
                            showAssignments={showAssignments}
                            onRemoveReviewer={removeReviewer}
                            onToggleAbsence={handleToggleAbsence}
                            onDataUpdate={fetchData}
                        />
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-4 justify-between">
                        <div className="flex items-center space-x-2 w-full sm:w-auto">
                            <Input
                                placeholder="New reviewer name"
                                value={newReviewerName}
                                onChange={(e) => setNewReviewerName(e.target.value)}
                                className="w-full sm:w-48"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleAddReviewer()
                                    }
                                }}
                            />
                            <Button onClick={handleAddReviewer}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <MoreHorizontal className="h-4 w-4 mr-2" />
                                        <span className="sm:inline">Actions</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Manage Data</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleResetCounts}>
                                        <RotateCw className="h-4 w-4 mr-2" />
                                        Reset Counts
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={exportData}>
                                        <Save className="h-4 w-4 mr-2" />
                                        Export Data
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault()
                                            document.getElementById("import-file")?.click()
                                        }}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Import Data
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <input id="import-file" type="file" accept=".json" onChange={importFileHandler} className="hidden" />
                        </div>
                    </CardFooter>
                </Card>
                <div className="flex flex-col gap-6">
                    <AssignmentCard
                        nextReviewer={nextReviewer}
                        assignmentFeed={assignmentFeed}
                        onAssignPR={assignPR}
                        onSkipReviewer={skipReviewer}
                        onUndoAssignment={undoAssignment}
                        onImTheNextOne={handleImTheNextOneWithDialog}
                    />

                    <div className="space-y-4">
                        <ForceAssignDialog reviewers={reviewers} onDataUpdate={fetchData} />
                    </div>

                    <RecentAssignments assignmentFeed={assignmentFeed} />
                </div>
            </div>

            {/* Snapshot Dialog */}
            <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Change History</DialogTitle>
                        <DialogDescription>View and restore from previous changes (last 10 changes)</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[300px] overflow-y-auto">
                        {snapshotsLoading ? (
                            <div className="text-center py-4">
                                <p>Loading history...</p>
                            </div>
                        ) : snapshots.length === 0 ? (
                            <div className="text-center py-4">
                                <p>No history available yet</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Changes will be saved automatically as you make them
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {snapshots.map((snapshot) => (
                                    <div
                                        key={snapshot.key}
                                        className="flex justify-between items-center p-3 border rounded-md hover:bg-muted/50"
                                    >
                                        <div>
                                            <p className="font-medium">{snapshot.formattedDate}</p>
                                            <p className="text-sm text-muted-foreground">{snapshot.description}</p>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => handleRestoreSnapshot(snapshot.key)}>
                                            Restore
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Skip Confirmation Dialog */}
            <SkipConfirmationDialog
                isOpen={skipConfirmDialogOpen}
                onOpenChange={setSkipConfirmDialogOpen}
                nextReviewer={nextReviewer}
                nextAfterSkip={nextAfterSkip}
                onConfirm={handleConfirmSkipToNext}
                onCancel={handleCancelSkip}
            />

            <div className="text-center text-xs text-muted-foreground">
                Last updated: {formatLastUpdated()} • Updates automatically every minute when tab is active
            </div>
        </div>
    )
}
