"use server";

import { redis } from "@/lib/redis";
import { type Reviewer, saveReviewers } from "./actions";

export interface BackupEntry {
	key: string;
	timestamp: number;
	formattedDate: string;
	description: string;
}

export interface BackupData {
	timestamp: number;
	description: string;
	data: Reviewer[];
}

const BACKUP_KEY_PREFIX = process.env.REDIS_KEY_BACKUP_PREFIX || "pr-reviewers-snapshot";
const MAX_SNAPSHOTS = 10;

// Create a snapshot after a change
export async function createSnapshot(
	reviewers: Reviewer[],
	description: string,
): Promise<boolean> {
	try {
		// Create new snapshot first
		const timestamp = Date.now();
		const backupKey = `${BACKUP_KEY_PREFIX}-${timestamp}`;

		// Store snapshot in Redis
		await redis.set(backupKey, {
			timestamp,
			description,
			data: reviewers,
		});

		// Get all existing snapshots (including the one we just created)
		const keys = await redis.keys(`${BACKUP_KEY_PREFIX}-*`);

		// Sort keys by timestamp (newest first)
		const sortedKeys = keys.sort((a, b) => {
			const timestampA = Number.parseInt(a.split("-").pop() || "0");
			const timestampB = Number.parseInt(b.split("-").pop() || "0");
			return timestampB - timestampA;
		});

		// If we have more than MAX_SNAPSHOTS, delete the oldest ones
		if (sortedKeys.length > MAX_SNAPSHOTS) {
			// Get keys to delete (oldest ones beyond our limit)
			const keysToDelete = sortedKeys.slice(MAX_SNAPSHOTS);

			// Delete old snapshots
			for (const key of keysToDelete) {
				await redis.del(key);
			}
		}

		return true;
	} catch (error) {
		console.error("Error creating snapshot:", error);
		return false;
	}
}

// Get all available snapshots
export async function getSnapshots(): Promise<BackupEntry[]> {
	try {
		// Get all snapshot keys
		const keys = await redis.keys(`${BACKUP_KEY_PREFIX}-*`);

		// Sort keys by timestamp (newest first)
		const sortedKeys = keys.sort((a, b) => {
			const timestampA = Number.parseInt(a.split("-").pop() || "0");
			const timestampB = Number.parseInt(b.split("-").pop() || "0");
			return timestampB - timestampA;
		});

		// Format the data for display
		const snapshots: BackupEntry[] = [];

		for (const key of sortedKeys) {
			const snapshot = await redis.get<BackupData>(key);
			if (snapshot) {
				snapshots.push({
					key,
					timestamp: snapshot.timestamp,
					formattedDate: "", // Will be formatted on client side
					description: snapshot.description,
				});
			}
		}

		return snapshots;
	} catch (error) {
		console.error("Error fetching snapshots:", error);
		return [];
	}
}

// Get a specific snapshot by key
export async function getSnapshotData(key: string): Promise<BackupData | null> {
	try {
		return await redis.get<BackupData>(key);
	} catch (error) {
		console.error("Error fetching snapshot data:", error);
		return null;
	}
}

// Restore from a snapshot
export async function restoreFromSnapshot(key: string): Promise<boolean> {
	try {
		const snapshot = await getSnapshotData(key);

		if (!snapshot || !snapshot.data) {
			return false;
		}

		// Save the snapshot data as the current reviewers
		const success = await saveReviewers(snapshot.data);

		if (success) {
			// Create a new snapshot to record this restore action
			await createSnapshot(
				snapshot.data,
				`Restored from snapshot`,
			);
		}

		return success;
	} catch (error) {
		console.error("Error restoring from snapshot:", error);
		return false;
	}
}
