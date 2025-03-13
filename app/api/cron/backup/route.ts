import {NextResponse} from "next/server"
import {redis} from "@/lib/redis"
import type {Reviewer} from "@/app/actions"

// Constants
const REDIS_KEY = "pr-reviewers"
const BACKUP_KEY_PREFIX = "pr-reviewers-backup"
const MAX_BACKUP_AGE_MS = 3 * 24 * 60 * 60 * 1000 // 3 days in milliseconds

export async function GET() {
    try {
        // Get current reviewers data
        const reviewers = await redis.get<Reviewer[]>(REDIS_KEY)

        if (!reviewers) {
            return NextResponse.json({ success: false, error: "No reviewers data found" }, { status: 404 })
        }

        // Create backup with timestamp
        const timestamp = Date.now()
        const backupKey = `${BACKUP_KEY_PREFIX}-${timestamp}`

        // Store backup in Redis
        await redis.set(backupKey, {
            timestamp,
            data: reviewers,
        })

        // Get all backup keys
        const keys = await redis.keys(`${BACKUP_KEY_PREFIX}-*`)

        // Sort keys by timestamp (newest first)
        const sortedKeys = keys.sort((a, b) => {
            const timestampA = Number.parseInt(a.split("-").pop() || "0")
            const timestampB = Number.parseInt(b.split("-").pop() || "0")
            return timestampB - timestampA
        })

        // Delete backups older than 3 days
        const cutoffTime = Date.now() - MAX_BACKUP_AGE_MS

        for (const key of sortedKeys) {
            const keyTimestamp = Number.parseInt(key.split("-").pop() || "0")
            if (keyTimestamp < cutoffTime) {
                await redis.del(key)
            }
        }

        return NextResponse.json({
            success: true,
            message: "Backup created successfully",
            timestamp,
            totalBackups: sortedKeys.length,
        })
    } catch (error) {
        console.error("Error creating backup:", error)
        return NextResponse.json({ success: false, error: "Failed to create backup" }, { status: 500 })
    }
}

// Export config for Vercel Cron
export const config = {
    runtime: "edge",
    regions: ["iad1"],
}

