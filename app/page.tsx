"use client"

import type React from "react"
import {useEffect, useState} from "react"
import {Button} from "@/components/ui/button"
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Badge} from "@/components/ui/badge"
import {Switch} from "@/components/ui/switch"
import {Label} from "@/components/ui/label"
import {
  AlertTriangle,
  Check,
  Download,
  Edit,
  RotateCw,
  Save,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react"
import {toast} from "@/hooks/use-toast"
import {
  addReviewer as addReviewerAction,
  forceAssignReviewer,
  getReviewers,
  incrementReviewerCount,
  removeReviewer as removeReviewerAction,
  resetAllCounts,
  type Reviewer,
  saveReviewers,
  signOutAuthKit,
  toggleAbsence,
  undoLastAssignment,
  updateAssignmentCount,
} from "./actions"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {useAuth} from "@workos-inc/authkit-nextjs/components";

export default function PRReviewAssignment() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [newReviewerName, setNewReviewerName] = useState("")
  const [nextReviewer, setNextReviewer] = useState<Reviewer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<number>(0)
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("")
  const [forceDialogOpen, setForceDialogOpen] = useState(false)
  const {user} = useAuth();

  // Load reviewers from Redis on initial load
  useEffect(() => {
    async function loadReviewers() {
      try {
        const data = await getReviewers()
        setReviewers(data)
        setIsLoading(false)
      } catch (error) {
        console.error("Error loading reviewers:", error)
        toast({
          title: "Error",
          description: "Failed to load reviewers from database",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    loadReviewers()
  }, [])

  // Find the next reviewer whenever the reviewers list changes
  useEffect(() => {
    if (reviewers.length > 0) {
      findNextReviewer()
    }
  }, [reviewers])

  const findNextReviewer = () => {
    // Filter out absent reviewers
    const availableReviewers = reviewers.filter((r) => !r.isAbsent)

    if (availableReviewers.length === 0) {
      setNextReviewer(null)
      return
    }

    // Find the minimum assignment count among available reviewers
    const minCount = Math.min(...availableReviewers.map((r) => r.assignmentCount))

    // Get all available reviewers with the minimum count
    const candidatesWithMinCount = availableReviewers.filter((r) => r.assignmentCount === minCount)

    // Sort by creation time (older first)
    const sortedCandidates = [...candidatesWithMinCount].sort((a, b) => a.createdAt - b.createdAt)

    // Select the first one
    setNextReviewer(sortedCandidates[0])
  }

  const assignPR = async () => {
    if (!nextReviewer) return

    // Increment the counter in Redis
    const success = await incrementReviewerCount(nextReviewer.id)

    if (success) {
      // Update local state
      setReviewers((prev) =>
        prev.map((reviewer) =>
          reviewer.id === nextReviewer.id ? { ...reviewer, assignmentCount: reviewer.assignmentCount + 1 } : reviewer,
        ),
      )

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
      // Update local state
      setReviewers((prev) =>
        prev.map((reviewer) =>
          reviewer.id === selectedReviewerId
            ? { ...reviewer, assignmentCount: reviewer.assignmentCount + 1 }
            : reviewer,
        ),
      )

      // Show appropriate toast based on reviewer status
      if (result.reviewer.isAbsent) {
        toast({
          title: "PR Force Assigned",
          description: `PR assigned to ${result.reviewer.name} who is currently marked as absent`,
          variant: "default",
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

    // Increment the counter in Redis
    const success = await incrementReviewerCount(nextReviewer.id)

    if (success) {
      // Update local state
      setReviewers((prev) =>
        prev.map((reviewer) =>
          reviewer.id === nextReviewer.id ? { ...reviewer, assignmentCount: reviewer.assignmentCount + 1 } : reviewer,
        ),
      )

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

  const undoAssignment = async () => {
    const result = await undoLastAssignment()

    if (result.success && result.reviewerId) {
      // Update local state
      setReviewers((prev) =>
        prev.map((reviewer) =>
          reviewer.id === result.reviewerId
            ? { ...reviewer, assignmentCount: Math.max(0, reviewer.assignmentCount - 1) }
            : reviewer,
        ),
      )

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
      // Reload reviewers to get the new one with proper ID
      const updatedReviewers = await getReviewers()
      setReviewers(updatedReviewers)
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
      // Update local state
      setReviewers((prev) => prev.filter((reviewer) => reviewer.id !== id))

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
      // Update local state
      setReviewers((prev) =>
        prev.map((reviewer) => (reviewer.id === id ? { ...reviewer, isAbsent: !reviewer.isAbsent } : reviewer)),
      )
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
      // Update local state
      setReviewers((prev) =>
        prev.map((reviewer) => (reviewer.id === editingId ? { ...reviewer, assignmentCount: editValue } : reviewer)),
      )

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
            // Update local state
            setReviewers(dataWithCreatedAt)

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
        // Update local state
        setReviewers((prev) => prev.map((reviewer) => ({ ...reviewer, assignmentCount: 0 })))

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
      <h1 className="text-3xl font-bold">PR Review - Remuneraciones Perú</h1>

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
                  <TableHead>Assignments</TableHead>
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
                    </TableCell>
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
          <CardFooter className="flex justify-between">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="New reviewer name"
                value={newReviewerName}
                onChange={(e) => setNewReviewerName(e.target.value)}
                className="w-48"
              />
              <Button onClick={addReviewer}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleResetCounts}>
                <RotateCw className="h-4 w-4 mr-2" />
                Reset Counts
              </Button>
              <Button variant="outline" onClick={exportData}>
                <Save className="h-4 w-4 mr-2" />
                Export
              </Button>
              <div className="relative">
                <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()}>
                  <Download className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </CardFooter>
        </Card>

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
      </div>
    </div>
  )
}

