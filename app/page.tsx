"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
    UserPlus,
    UserMinus,
    RotateCw,
    Save,
    Download,
    Undo2,
    Edit,
    Check,
    X,
    AlertTriangle,
    UserCheck,
    Clock,
    Eye,
    EyeOff,
    RefreshCw, MoreHorizontal, User,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
    getReviewers,
    saveReviewers,
    incrementReviewerCount,
    resetAllCounts,
    toggleAbsence,
    removeReviewer as removeReviewerAction,
    undoLastAssignment,
    updateAssignmentCount,
    addReviewer as addReviewerAction,
    forceAssignReviewer,
    skipToNextReviewer,
    getAssignmentFeed,
    type Reviewer, signOutAuthKit,
    type AssignmentFeed,
} from "./actions"
import { getSnapshots, restoreFromSnapshot, type BackupEntry } from "./backup-actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { useAuth } from '@workos-inc/authkit-nextjs/components';

export default function PRReviewAssignment() {
    const [reviewers, setReviewers] = useState<Reviewer[]>([])
    const [newReviewerName, setNewReviewerName] = useState("")
    const [nextReviewer, setNextReviewer] = useState<Reviewer | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<number>(0)
    const [selectedReviewerId, setSelectedReviewerId] = useState<string>("")
    const [forceDialogOpen, setForceDialogOpen] = useState(false)
    const [snapshots, setSnapshots] = useState<BackupEntry[]>([])
    const [snapshotsLoading, setSnapshotsLoading] = useState(false)
    const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
    const [showAssignments, setShowAssignments] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [assignmentFeed, setAssignmentFeed] = useState<AssignmentFeed>({ items: [], lastAssigned: null })
    const [skipConfirmDialogOpen, setSkipConfirmDialogOpen] = useState(false)
    const [nextAfterSkip, setNextAfterSkip] = useState<Reviewer | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const UPDATE_INTERVAL = 60000 // 1 minute in milliseconds

    const { user, loading } = useAuth();
    // Function to fetch reviewers data and assignment feed
    const fetchData = useCallback(async (showLoadingState = false) => {
        if (showLoadingState) {
            setIsRefreshing(true)
        }

        try {
            const [reviewersData, feedData] = await Promise.all([getReviewers(), getAssignmentFeed()])

            setReviewers(reviewersData)
            setAssignmentFeed(feedData)
            setLastUpdated(new Date())
        } catch (error) {
            console.error("Error loading data:", error)
            toast({
                title: "Error",
                description: "Failed to refresh data from database",
                variant: "destructive",
            })
        } finally {
            if (showLoadingState) {
                setIsRefreshing(false)
            }
        }
    }, [])

    // Load reviewers from Redis on initial load
    useEffect(() => {
        async function loadInitialData() {
            try {
                const [reviewersData, feedData] = await Promise.all([getReviewers(), getAssignmentFeed()])

                setReviewers(reviewersData)
                setAssignmentFeed(feedData)
                setLastUpdated(new Date())
                setIsLoading(false)
            } catch (error) {
                console.error("Error loading initial data:", error)
                toast({
                    title: "Error",
                    description: "Failed to load data from database",
                    variant: "destructive",
                })
                setIsLoading(false)
            }
        }

        loadInitialData()

        // Load show assignments preference from localStorage
        const savedShowAssignments = localStorage.getItem("showAssignments")
        if (savedShowAssignments !== null) {
            setShowAssignments(savedShowAssignments === "true")
        }
    }, [])

    // Save show assignments preference to localStorage
    useEffect(() => {
        localStorage.setItem("showAssignments", showAssignments.toString())
    }, [showAssignments])

    // Set up interval for periodic updates
    useEffect(() => {
        // Only set up the interval once the initial data is loaded
        if (isLoading) return

        // Set up interval to fetch data every minute
        intervalRef.current = setInterval(() => {
            fetchData()
        }, UPDATE_INTERVAL)

        // Clean up on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [isLoading, fetchData])

    // Handle visibility change to pause/resume updates when tab is hidden
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                // Refresh data immediately when tab becomes visible
                fetchData()

                // Restart the interval
                if (intervalRef.current) {
                    clearInterval(intervalRef.current)
                }

                intervalRef.current = setInterval(() => {
                    fetchData()
                }, UPDATE_INTERVAL)
            } else {
                // Clear interval when tab is hidden
                if (intervalRef.current) {
                    clearInterval(intervalRef.current)
                    intervalRef.current = null
                }
            }
        }

        // Add event listener
        document.addEventListener("visibilitychange", handleVisibilityChange)

        // Clean up
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [fetchData])

    // Find the next reviewer whenever the reviewers list changes
    useEffect(() => {
        if (reviewers.length > 0) {
            findNextReviewer()
        }
    }, [reviewers])

    const findNextReviewer = async () => {
        // Get all reviewers (including absent ones)
        if (reviewers.length === 0) {
            setNextReviewer(null)
            return
        }

        // Find the minimum assignment count among all reviewers
        const minCount = Math.min(...reviewers.map((r) => r.assignmentCount))

        // Get all reviewers with the minimum count
        const candidatesWithMinCount = reviewers.filter((r) => r.assignmentCount === minCount)

        // Sort by creation time (older first)
        const sortedCandidates = [...candidatesWithMinCount].sort((a, b) => a.createdAt - b.createdAt)

        // Check if the first candidate is absent
        if (sortedCandidates.length > 0) {
            const firstCandidate = sortedCandidates[0]

            if (firstCandidate.isAbsent) {
                // Increment the counter for the absent reviewer, but mark it as an absent skip
                const success = await incrementReviewerCount(firstCandidate.id, true, true)

                if (success) {
                    // Refresh data and find next reviewer again
                    await fetchData()
                    // This will trigger useEffect which will call findNextReviewer again
                } else {
                    toast({
                        title: "Error",
                        description: "Failed to skip absent reviewer. Please try again.",
                        variant: "destructive",
                    })
                }
            } else {
                // If not absent, set as next reviewer
                setNextReviewer(firstCandidate)
            }
        } else {
            setNextReviewer(null)
        }
    }

    const assignPR = async () => {
        if (!nextReviewer) return

        // Increment the counter in Redis
        const success = await incrementReviewerCount(nextReviewer.id, false, false)

        if (success) {
            // Refresh data to get updated reviewers and feed
            await fetchData()

            toast({
                title: "PR Assigned",
                description: `PR assigned to ${nextReviewer.name}`,
            })
        } else {
            toast({
                title: "Error",
                description: "Failed to assign PR. Please try again.",
                variant: "destructive",
            })
        }
    }

    const handleForceAssign = async () => {
        if (!selectedReviewerId) {
            toast({
                title: "Error",
                description: "Please select a reviewer to force assign",
                variant: "destructive",
            })
            return
        }

        const result = await forceAssignReviewer(selectedReviewerId)

        if (result.success && result.reviewer) {
            // Refresh data to get updated reviewers and feed
            await fetchData()

            // Show appropriate toast based on reviewer status
            if (result.reviewer.isAbsent) {
                toast({
                    title: "PR Force Assigned",
                    description: `PR assigned to ${result.reviewer.name} who is currently marked as absent`,
                })
            } else {
                toast({
                    title: "PR Force Assigned",
                    description: `PR assigned to ${result.reviewer.name}`,
                })
            }

            // Close the dialog
            setForceDialogOpen(false)
            setSelectedReviewerId("")
        } else {
            toast({
                title: "Error",
                description: "Failed to force assign PR. Please try again.",
                variant: "destructive",
            })
        }
    }

    const skipReviewer = async () => {
        if (!nextReviewer) return

        // Increment the counter in Redis with skipped flag
        const success = await incrementReviewerCount(nextReviewer.id, true, false)

        if (success) {
            // Refresh data to get updated reviewers and feed
            await fetchData()

            toast({
                title: "Reviewer Skipped",
                description: `${nextReviewer.name} was skipped but their count was increased`,
            })
        } else {
            toast({
                title: "Error",
                description: "Failed to skip reviewer. Please try again.",
                variant: "destructive",
            })
        }
    }


    const handleImTheNextOne = async () => {
        if (!nextReviewer) return

        // Find the next reviewer that's not the current next one
        const result = await skipToNextReviewer(nextReviewer.id)

        if (result.success && result.nextReviewer) {
            // Store the next reviewer after skip for the confirmation dialog
            setNextAfterSkip(result.nextReviewer)
            // Open the confirmation dialog
            setSkipConfirmDialogOpen(true)
        } else {
            toast({
                title: "Error",
                description: "No other available reviewers found.",
                variant: "destructive",
            })
        }
    }


    const confirmSkipToNext = () => {
        if (!nextReviewer || !nextAfterSkip) return

        // Update local state to show the new next reviewer
        setNextReviewer(nextAfterSkip)

        toast({
            title: "Next Reviewer Updated",
            description: `${nextReviewer.name} was skipped. ${nextAfterSkip.name} is now the next reviewer.`,
        })

        // Close the dialog
        setSkipConfirmDialogOpen(false)
        setNextAfterSkip(null)
    }

    const undoAssignment = async () => {
        const result = await undoLastAssignment()

        if (result.success && result.reviewerId) {
            // Refresh data to get updated reviewers and feed
            await fetchData()

            toast({
                title: "Assignment Undone",
                description: "The last PR assignment has been undone",
            })
        } else {
            toast({
                title: "Error",
                description: "No assignments to undo or operation failed",
                variant: "destructive",
            })
        }
    }

    const addReviewer = async () => {
        if (!newReviewerName.trim()) {
            toast({
                title: "Error",
                description: "Please enter a name for the new reviewer",
                variant: "destructive",
            })
            return
        }

        // Add to Redis
        const success = await addReviewerAction(newReviewerName.trim())

        if (success) {
            // Refresh data to get updated reviewers
            await fetchData()
            setNewReviewerName("")

            toast({
                title: "Reviewer Added",
                description: `${newReviewerName} has been added to the rotation`,
            })
        } else {
            toast({
                title: "Error",
                description: "Failed to add reviewer. Please try again.",
                variant: "destructive",
            })
        }
    }

    const removeReviewer = async (id: string) => {
        // Remove from Redis
        const success = await removeReviewerAction(id)

        if (success) {
            // Refresh data to get updated reviewers
            await fetchData()

            toast({
                title: "Reviewer Removed",
                description: "Reviewer has been removed from the rotation",
            })
        } else {
            toast({
                title: "Error",
                description: "Failed to remove reviewer. Please try again.",
                variant: "destructive",
            })
        }
    }

    const handleToggleAbsence = async (id: string) => {
        // Toggle in Redis
        const success = await toggleAbsence(id)

        if (success) {
            // Refresh data to get updated reviewers
            await fetchData()
        } else {
            toast({
                title: "Error",
                description: "Failed to update reviewer status. Please try again.",
                variant: "destructive",
            })
        }
    }

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
            await fetchData()

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

    const exportData = () => {
        const dataStr = JSON.stringify(reviewers, null, 2)
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`

        const exportFileDefaultName = `pr-reviewers-${new Date().toISOString().slice(0, 10)}.json`

        const linkElement = document.createElement("a")
        linkElement.setAttribute("href", dataUri)
        linkElement.setAttribute("download", exportFileDefaultName)
        linkElement.click()
    }

    const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target?.result as string)
                if (Array.isArray(importedData)) {
                    // Ensure all imported reviewers have createdAt
                    const dataWithCreatedAt = importedData.map((reviewer) => {
                        if (!reviewer.createdAt) {
                            return { ...reviewer, createdAt: Date.now() }
                        }
                        return reviewer
                    })

                    // Save to Redis
                    const success = await saveReviewers(dataWithCreatedAt)

                    if (success) {
                        // Refresh data to get updated reviewers
                        await fetchData()

                        toast({
                            title: "Data Imported",
                            description: "Reviewer data has been successfully imported",
                        })
                    } else {
                        toast({
                            title: "Import Error",
                            description: "Failed to save imported data to database",
                            variant: "destructive",
                        })
                    }
                }
            } catch (error) {
                toast({
                    title: "Import Error",
                    description: "Failed to import data. Please check the file format.",
                    variant: "destructive",
                })
            }
        }
        reader.readAsText(file)

        // Reset the input
        event.target.value = ""
    }

    const handleResetCounts = async () => {
        if (confirm("Are you sure you want to reset all assignment counts to zero?")) {
            // Reset in Redis
            const success = await resetAllCounts()

            if (success) {
                // Refresh data to get updated reviewers
                await fetchData()

                toast({
                    title: "Counts Reset",
                    description: "All assignment counts have been reset to zero",
                })
            } else {
                toast({
                    title: "Error",
                    description: "Failed to reset counts. Please try again.",
                    variant: "destructive",
                })
            }
        }
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

    const handleManualRefresh = () => {
        fetchData(true)
    }

    // Format the last updated time
    const formatLastUpdated = () => {
        return lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }


    if (isLoading) {
        return (
            <div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Loading...</h2>
                    <p className="text-muted-foreground">Fetching reviewer data from database</p>
                </div>
            </div>
        )
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

    if (!user){
        return (
            <div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">You are not authenticated</h2>
                    <p className="text-muted-foreground">Please sign in to access this page</p>
                </div>
            </div>
        )
    }

    if(user && (!user.email.endsWith('@buk.cl') && !user.email.endsWith('@buk.pe'))){
        return (
            <div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">You are not authorized</h2>
                    <p className="text-muted-foreground">Please sign in with a valid email address. You're currently using {user.email}</p>
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
                                            {nextReviewer?.id === reviewer.id && <Badge className="ml-2 bg-green-500">Next</Badge>}
                                            {assignmentFeed.lastAssigned?.reviewerId === reviewer.id && (
                                                <Badge className="ml-2 bg-blue-500">Last Assigned</Badge>
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
                                                    onCheckedChange={() => handleToggleAbsence(reviewer.id)}
                                                />
                                                <Label htmlFor={`absence-${reviewer.id}`}>{reviewer.isAbsent ? "Absent" : "Available"}</Label>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => removeReviewer(reviewer.id)}>
                                                <UserMinus className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-4 justify-between">
                        <div className="flex items-center space-x-2 w-full sm:w-auto">
                            <Input
                                placeholder="New reviewer name"
                                value={newReviewerName}
                                onChange={(e) => setNewReviewerName(e.target.value)}
                                className="w-full sm:w-48"
                            />
                            <Button onClick={addReviewer}>
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
                            <input id="import-file" type="file" accept=".json" onChange={importData} className="hidden" />
                        </div>
                    </CardFooter>
                </Card>
                <div className="flex flex-col gap-6">
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
                        <Button variant="outline" onClick={skipReviewer} disabled={!nextReviewer}>
                            Skip
                        </Button>
                        <Button onClick={assignPR} disabled={!nextReviewer}>
                            Assign PR
                        </Button>
                    </CardFooter>
                    <div className="px-6 pb-6 space-y-4">
                        <Button variant="secondary" className="w-full" onClick={undoAssignment}>
                            <Undo2 className="h-4 w-4 mr-2" />
                            Undo Last Assignment
                        </Button>

                        <Button variant="outline" className="w-full" onClick={handleImTheNextOne} disabled={!nextReviewer}>
                            <User className="h-4 w-4 mr-2" />
                            I'm the Next One
                        </Button>

                        <Dialog open={forceDialogOpen} onOpenChange={setForceDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Force Assign PR
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Force Assign PR</DialogTitle>
                                    <DialogDescription>
                                        Select a specific reviewer to assign a PR to, regardless of the normal rotation.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select a reviewer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {reviewers.map((reviewer) => (
                                                <SelectItem key={reviewer.id} value={reviewer.id}>
                                                    <div className="flex items-center">
                                                        <span>{reviewer.name}</span>
                                                        {reviewer.isAbsent && <AlertTriangle className="h-4 w-4 ml-2 text-amber-500" />}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {selectedReviewerId && reviewers.find((r) => r.id === selectedReviewerId)?.isAbsent && (
                                        <div className="mt-2 text-sm text-amber-500 flex items-center">
                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                            <span>This reviewer is currently marked as absent</span>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setForceDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleForceAssign}>Force Assign</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </Card>


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
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                        Forced
                                                    </Badge>
                                                )}
                                                {item.skipped && (
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                        Skipped
                                                    </Badge>
                                                )}
                                                {!item.forced && !item.skipped && (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
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
                    <DialogFooter></DialogFooter> {/* Added missing DialogFooter */}
                </DialogContent>
            </Dialog>

            {/* Skip Confirmation Dialog */}
            <Dialog open={skipConfirmDialogOpen} onOpenChange={setSkipConfirmDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Confirm Skip</DialogTitle>
                        <DialogDescription>You're about to skip yourself in the PR review rotation.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {nextReviewer && nextAfterSkip && (
                            <p className="text-center">
                                Hey <span className="font-bold">{nextReviewer.name}</span>! You'll be skipped and you'll assign this PR
                                to <span className="font-bold">{nextAfterSkip.name}</span>. Do you confirm?
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSkipConfirmDialogOpen(false)
                                setNextAfterSkip(null)
                            }}
                        >
                            Cancel
                        </Button>
                        <Button onClick={confirmSkipToNext}>Confirm</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="text-center text-xs text-muted-foreground">
                Last updated: {formatLastUpdated()} • Updates automatically every minute when tab is active
            </div>
        </div>
    )
}

