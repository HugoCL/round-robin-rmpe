"use server"

import {redis} from "@/lib/redis"
import {signOut} from '@workos-inc/authkit-nextjs';

export interface Reviewer {
  id: string
  name: string
  assignmentCount: number
  isAbsent: boolean
  createdAt: number // Adding timestamp for ordering
}

export interface AssignmentHistory {
  reviewerId: string
  timestamp: number
  forced: boolean // Track if this was a forced assignment
}

const REDIS_KEY = "pr-reviewers"
const HISTORY_KEY = "pr-assignment-history"

// Default reviewers based on the screenshot
const defaultReviewers: Reviewer[] = [
  { id: "1", name: "Marco", assignmentCount: 167, isAbsent: false, createdAt: 1614556800000 },
  { id: "2", name: "Max", assignmentCount: 167, isAbsent: true, createdAt: 1614556800001 },
  { id: "3", name: "Seba", assignmentCount: 166, isAbsent: false, createdAt: 1614556800002 },
  { id: "4", name: "Jose Daniel", assignmentCount: 166, isAbsent: false, createdAt: 1614556800003 },
  { id: "5", name: "Hugo", assignmentCount: 166, isAbsent: false, createdAt: 1614556800004 },
  { id: "6", name: "Elizabeth", assignmentCount: 166, isAbsent: false, createdAt: 1614556800005 },
  { id: "7", name: "Alexis", assignmentCount: 166, isAbsent: false, createdAt: 1614556800006 },
  { id: "8", name: "Nicolás", assignmentCount: 166, isAbsent: false, createdAt: 1614556800007 },
  { id: "9", name: "Pablo", assignmentCount: 166, isAbsent: false, createdAt: 1614556800008 },
]

export async function getReviewers(): Promise<Reviewer[]> {
  try {
    // Try to get reviewers from Redis
    const reviewers = await redis.get<Reviewer[]>(REDIS_KEY)

    // If no reviewers found, initialize with default data
    if (!reviewers) {
      await redis.set(REDIS_KEY, defaultReviewers)
      return defaultReviewers
    }

    // Ensure all reviewers have a createdAt timestamp
    const updatedReviewers = reviewers.map((reviewer) => {
      if (!reviewer.createdAt) {
        return { ...reviewer, createdAt: Date.now() }
      }
      return reviewer
    })

    // If we had to add createdAt to any reviewers, update Redis
    if (updatedReviewers.some((r, i) => !reviewers[i].createdAt)) {
      await redis.set(REDIS_KEY, updatedReviewers)
      return updatedReviewers
    }

    return reviewers
  } catch (error) {
    console.error("Error fetching reviewers from Redis:", error)
    return defaultReviewers
  }
}

export async function saveReviewers(reviewers: Reviewer[]): Promise<boolean> {
  try {
    await redis.set(REDIS_KEY, reviewers)
    return true
  } catch (error) {
    console.error("Error saving reviewers to Redis:", error)
    return false
  }
}

export async function updateReviewer(reviewer: Reviewer): Promise<boolean> {
  try {
    const reviewers = await getReviewers()
    const updatedReviewers = reviewers.map((r) => (r.id === reviewer.id ? reviewer : r))

    return await saveReviewers(updatedReviewers)
  } catch (error) {
    console.error("Error updating reviewer in Redis:", error)
    return false
  }
}

export async function addReviewer(name: string): Promise<boolean> {
  try {
    const reviewers = await getReviewers()

    // Find the minimum assignment count to start the new reviewer at
    const minCount = Math.min(...reviewers.map((r) => r.assignmentCount))

    const newReviewer: Reviewer = {
      id: Date.now().toString(),
      name: name.trim(),
      assignmentCount: minCount,
      isAbsent: false,
      createdAt: Date.now(),
    }

    reviewers.push(newReviewer)

    return await saveReviewers(reviewers)
  } catch (error) {
    console.error("Error adding reviewer to Redis:", error)
    return false
  }
}

export async function removeReviewer(id: string): Promise<boolean> {
  try {
    const reviewers = await getReviewers()
    const filteredReviewers = reviewers.filter((r) => r.id !== id)

    return await saveReviewers(filteredReviewers)
  } catch (error) {
    console.error("Error removing reviewer from Redis:", error)
    return false
  }
}

export async function incrementReviewerCount(id: string): Promise<boolean> {
  try {
    const reviewers = await getReviewers()
    const updatedReviewers = reviewers.map((r) => (r.id === id ? { ...r, assignmentCount: r.assignmentCount + 1 } : r))

    // Add to assignment history
    await addToAssignmentHistory(id, false)

    return await saveReviewers(updatedReviewers)
  } catch (error) {
    console.error("Error incrementing reviewer count in Redis:", error)
    return false
  }
}

export async function forceAssignReviewer(id: string): Promise<{ success: boolean; reviewer?: Reviewer }> {
  try {
    const reviewers = await getReviewers()
    const reviewer = reviewers.find((r) => r.id === id)

    if (!reviewer) {
      return { success: false }
    }

    const updatedReviewers = reviewers.map((r) => (r.id === id ? { ...r, assignmentCount: r.assignmentCount + 1 } : r))

    // Add to assignment history with forced flag
    await addToAssignmentHistory(id, true)

    // Save updated reviewers
    await saveReviewers(updatedReviewers)

    return { success: true, reviewer }
  } catch (error) {
    console.error("Error force assigning reviewer in Redis:", error)
    return { success: false }
  }
}

export async function updateAssignmentCount(id: string, count: number): Promise<boolean> {
  try {
    const reviewers = await getReviewers()
    const updatedReviewers = reviewers.map((r) => (r.id === id ? { ...r, assignmentCount: count } : r))

    return await saveReviewers(updatedReviewers)
  } catch (error) {
    console.error("Error updating assignment count in Redis:", error)
    return false
  }
}

export async function resetAllCounts(): Promise<boolean> {
  try {
    const reviewers = await getReviewers()
    const updatedReviewers = reviewers.map((r) => ({ ...r, assignmentCount: 0 }))

    // Clear assignment history
    await redis.set(HISTORY_KEY, [])

    return await saveReviewers(updatedReviewers)
  } catch (error) {
    console.error("Error resetting counts in Redis:", error)
    return false
  }
}

export async function toggleAbsence(id: string): Promise<boolean> {
  try {
    const reviewers = await getReviewers()
    const updatedReviewers = reviewers.map((r) => (r.id === id ? { ...r, isAbsent: !r.isAbsent } : r))

    return await saveReviewers(updatedReviewers)
  } catch (error) {
    console.error("Error toggling absence in Redis:", error)
    return false
  }
}

// Assignment history functions for undo feature
async function addToAssignmentHistory(reviewerId: string, forced: boolean): Promise<boolean> {
  try {
    const history = await getAssignmentHistory()

    const updatedHistory = [{ reviewerId, timestamp: Date.now(), forced }, ...history].slice(0, 50) // Keep only the last 50 assignments

    await redis.set(HISTORY_KEY, updatedHistory)
    return true
  } catch (error) {
    console.error("Error adding to assignment history:", error)
    return false
  }
}

async function getAssignmentHistory(): Promise<AssignmentHistory[]> {
  try {
    const history = await redis.get<AssignmentHistory[]>(HISTORY_KEY)
    return history || []
  } catch (error) {
    console.error("Error getting assignment history:", error)
    return []
  }
}

export async function undoLastAssignment(): Promise<{ success: boolean; reviewerId?: string }> {
  try {
    const history = await getAssignmentHistory()

    if (history.length === 0) {
      return { success: false }
    }

    const lastAssignment = history[0]
    const reviewers = await getReviewers()

    const reviewer = reviewers.find((r) => r.id === lastAssignment.reviewerId)

    if (!reviewer) {
      return { success: false }
    }

    // Decrement the count
    const updatedReviewers = reviewers.map((r) =>
      r.id === lastAssignment.reviewerId ? { ...r, assignmentCount: Math.max(0, r.assignmentCount - 1) } : r,
    )

    // Remove from history
    const updatedHistory = history.slice(1)
    await redis.set(HISTORY_KEY, updatedHistory)

    // Save updated reviewers
    await saveReviewers(updatedReviewers)

    return { success: true, reviewerId: lastAssignment.reviewerId }
  } catch (error) {
    console.error("Error undoing last assignment:", error)
    return { success: false }
  }
}

export async function signOutAuthKit() {
  await signOut();
}

