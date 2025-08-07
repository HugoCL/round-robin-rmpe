// @ts-nocheck
/* eslint-disable */
// DEPRECATED: This migration script was used to migrate from Redis to Convex
// TypeScript checking and linting are disabled for this file since it's no longer used

/**
 * Data Migration Script: Redis to Convex
 * 
 * This script helps migrate existing data from Redis to Convex.
 * Run this after setting up Convex to preserve your existing data.
 */

// import {
//     getReviewers,
//     getTags,
//     getAssignmentFeed,
// } from "@/app/[locale]/actions";

interface MigrationData {
    reviewers: unknown[];
    tags: unknown[];
    assignmentFeed: unknown;
}

export async function exportDataFromRedis(): Promise<MigrationData> {
    try {
        console.log("Exporting data from Redis...");

        const [reviewers, tags, assignmentFeed] = await Promise.all([
            getReviewers(),
            getTags(),
            getAssignmentFeed(),
        ]);

        const migrationData = {
            reviewers,
            tags,
            assignmentFeed,
        };

        // Save to file for manual import if needed
        const dataStr = JSON.stringify(migrationData, null, 2);
        console.log("Migration data:", dataStr);

        return migrationData;
    } catch (error) {
        console.error("Error exporting data from Redis:", error);
        throw error;
    }
}

export async function importDataToConvex(data: MigrationData) {
    // This would be called from a Convex action
    // For now, this is a placeholder that shows the structure
    console.log("Data to import to Convex:", data);

    // Note: The actual import would be done via Convex mutations
    // from the client side after the user triggers the migration
}

// Usage instructions:
// 1. Run: await exportDataFromRedis() to get your current data
// 2. Copy the output JSON
// 3. Use the Convex dashboard or mutations to import the data
// 4. Verify the data in Convex
// 5. Update your app to use the new hooks
