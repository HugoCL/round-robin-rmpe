"use server"

import {redis} from "@/lib/redis"
import {type Reviewer, saveReviewers} from "./actions"
import {notifyClients} from "./api/updates/route"

export interface BackupEntry {
    key: string
    timestamp: number
    formattedDate: string
}

export interface BackupData {
    timestamp: number
    data: Reviewer[]
}

const BACKUP_KEY_PREFIX = "pr-reviewers-backup"

// Get all available backups
export async function getBackups(): Promise<BackupEntry[]> {
    try {
        // Get all backup keys
        const keys = await redis.keys(`${BACKUP_KEY_PREFIX}-*`)

        // Sort keys by timestamp (newest first)
        const sortedKeys = keys.sort((a, b) => {
            const timestampA = Number.parseInt(a.split("-").pop() || "0")
            const timestampB = Number.parseInt(b.split("-").pop() || "0")
            return timestampB - timestampA
        })

        // Format the data for display
        return sortedKeys.map((key) => {
            const timestamp = Number.parseInt(key.split("-").pop() || "0")
            const date = new Date(timestamp)

            return {
                key,
                timestamp,
                formattedDate: formatDate(date),
            }
        })
    } catch (error) {
        console.error("Error fetching backups:", error)
        return []
    }
}

// Get a specific backup by key
export async function getBackupData(key: string): Promise<BackupData | null> {
    try {
        return await redis.get<BackupData>(key)
    } catch (error) {
        console.error("Error fetching backup data:", error)
        return null
    }
}

// Restore from a backup
export async function restoreFromBackup(key: string): Promise<boolean> {
    try {
        const backup = await getBackupData(key)

        if (!backup || !backup.data) {
            return false
        }

        // Save the backup data as the current reviewers
        const success = await saveReviewers(backup.data)

        if (success) {
            // Notify clients about the restore
            notifyClients({ type: "backup-restored", timestamp: backup.timestamp })
        }

        return success
    } catch (error) {
        console.error("Error restoring from backup:", error)
        return false
    }
}

// Helper function to format date
function formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }

    return date.toLocaleDateString("en-US", options)
}

