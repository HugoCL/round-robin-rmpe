import { mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Initialize default data
export const initializeData = mutation({
    args: {},
    handler: async (ctx) => {
        // Check if we already have data
        const existingReviewers = await ctx.db.query("reviewers").take(1);
        if (existingReviewers.length > 0) {
            return { success: true, message: "Data already initialized" };
        }

        // Create default reviewers
        const defaultReviewers = [
            {
                name: "Juan",
                email: "juan@example.com",
                assignmentCount: 0,
                isAbsent: false,
                createdAt: 1614556800000,
                tags: [],
            },
            {
                name: "Pedro",
                email: "pedro@example.com",
                assignmentCount: 0,
                isAbsent: false,
                createdAt: 1614556800001,
                tags: [],
            },
        ];

        for (const reviewer of defaultReviewers) {
            await ctx.db.insert("reviewers", reviewer);
        }

        return { success: true, message: "Default data initialized" };
    },
});

// Reviewer mutations
export const addReviewer = mutation({
    args: {
        name: v.string(),
        email: v.string(),
    },
    handler: async (ctx, { name, email }) => {
        // Check if email already exists
        const existingReviewer = await ctx.db
            .query("reviewers")
            .withIndex("by_email", q => q.eq("email", email.toLowerCase()))
            .first();

        if (existingReviewer) {
            throw new Error("Email already exists");
        }

        // Get all reviewers to find minimum assignment count
        const allReviewers = await ctx.db.query("reviewers").collect();
        const minCount = allReviewers.length > 0
            ? Math.min(...allReviewers.map(r => r.assignmentCount))
            : 0;

        const reviewerId = await ctx.db.insert("reviewers", {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            assignmentCount: minCount,
            isAbsent: false,
            createdAt: Date.now(),
            tags: [],
        });

        // Create backup snapshot
        await createSnapshot(ctx, `Added reviewer: ${name} (${email})`);

        return reviewerId;
    },
});

export const updateReviewer = mutation({
    args: {
        id: v.id("reviewers"),
        name: v.string(),
        email: v.string(),
    },
    handler: async (ctx, { id, name, email }) => {
        const reviewer = await ctx.db.get(id);
        if (!reviewer) {
            throw new Error("Reviewer not found");
        }

        // Check if email conflicts with another reviewer
        const emailConflict = await ctx.db
            .query("reviewers")
            .withIndex("by_email", q => q.eq("email", email.toLowerCase()))
            .filter(q => q.neq(q.field("_id"), id))
            .first();

        if (emailConflict) {
            throw new Error("Email already exists");
        }

        await ctx.db.patch(id, {
            name: name.trim(),
            email: email.trim().toLowerCase(),
        });

        // Create backup snapshot
        await createSnapshot(ctx, `Updated reviewer: ${name}`);

        return id;
    },
});

export const removeReviewer = mutation({
    args: {
        id: v.id("reviewers"),
    },
    handler: async (ctx, { id }) => {
        const reviewer = await ctx.db.get(id);
        if (!reviewer) {
            throw new Error("Reviewer not found");
        }

        await ctx.db.delete(id);

        // Create backup snapshot
        await createSnapshot(ctx, `Removed reviewer: ${reviewer.name}`);

        return { success: true };
    },
});

export const toggleReviewerAbsence = mutation({
    args: {
        id: v.id("reviewers"),
    },
    handler: async (ctx, { id }) => {
        const reviewer = await ctx.db.get(id);
        if (!reviewer) {
            throw new Error("Reviewer not found");
        }

        const isCurrentlyAbsent = reviewer.isAbsent;

        const updateData: { isAbsent: boolean; assignmentCount?: number } = {
            isAbsent: !isCurrentlyAbsent
        };

        // If unmarking as absent, update assignment count to most common value
        if (isCurrentlyAbsent) {
            const allReviewers = await ctx.db.query("reviewers").collect();
            const availableReviewers = allReviewers.filter(r => !r.isAbsent || r._id === id);
            const mostCommonCount = getMostCommonAssignmentCount(availableReviewers);
            updateData.assignmentCount = mostCommonCount;
        }

        await ctx.db.patch(id, updateData);

        // Create backup snapshot
        const status = isCurrentlyAbsent ? "available" : "absent";
        const countMessage = isCurrentlyAbsent
            ? ` and updated assignment count to ${updateData.assignmentCount}`
            : "";
        await createSnapshot(ctx, `Marked ${reviewer.name} as ${status}${countMessage}`);

        return { success: true };
    },
});

export const updateAssignmentCount = mutation({
    args: {
        id: v.id("reviewers"),
        count: v.number(),
    },
    handler: async (ctx, { id, count }) => {
        const reviewer = await ctx.db.get(id);
        if (!reviewer) {
            throw new Error("Reviewer not found");
        }

        await ctx.db.patch(id, { assignmentCount: count });

        // Create backup snapshot  
        await createSnapshot(ctx, `Updated count for ${reviewer.name} to ${count}`);

        return { success: true };
    },
});

export const resetAllCounts = mutation({
    args: {},
    handler: async (ctx) => {
        const allReviewers = await ctx.db.query("reviewers").collect();

        // Reset all reviewer counts
        for (const reviewer of allReviewers) {
            await ctx.db.patch(reviewer._id, { assignmentCount: 0 });
        }

        // Clear assignment history
        const allHistory = await ctx.db.query("assignmentHistory").collect();
        for (const history of allHistory) {
            await ctx.db.delete(history._id);
        }

        // Create backup snapshot
        await createSnapshot(ctx, "Reset all assignment counts");

        return { success: true };
    },
});

// Assignment mutations
export const assignPR = mutation({
    args: {
        reviewerId: v.id("reviewers"),
        forced: v.optional(v.boolean()),
        skipped: v.optional(v.boolean()),
        isAbsentSkip: v.optional(v.boolean()),
        tagId: v.optional(v.id("tags")),
        actionBy: v.optional(v.object({
            email: v.string(),
            firstName: v.optional(v.string()),
            lastName: v.optional(v.string()),
        })),
    },
    handler: async (ctx, { reviewerId, forced = false, skipped = false, isAbsentSkip = false, tagId, actionBy }) => {
        const reviewer = await ctx.db.get(reviewerId);
        if (!reviewer) {
            throw new Error("Reviewer not found");
        }

        // Increment assignment count
        await ctx.db.patch(reviewerId, {
            assignmentCount: reviewer.assignmentCount + 1
        });

        // Add to assignment history
        await ctx.db.insert("assignmentHistory", {
            reviewerId,
            reviewerName: reviewer.name,
            timestamp: Date.now(),
            forced,
            skipped,
            isAbsentSkip,
            tagId,
            actionBy,
        });

        // Create backup snapshot
        let action = "Assigned PR to";
        if (skipped) action = "Skipped";
        if (isAbsentSkip) action = "Auto-skipped absent reviewer";

        const tagName = tagId ? (await ctx.db.get(tagId))?.name : undefined;
        const tagMessage = tagName ? ` (${tagName} track)` : "";

        await createSnapshot(ctx, `${action}: ${reviewer.name}${tagMessage}`);

        return {
            success: true, reviewer: {
                id: reviewer._id,
                name: reviewer.name,
                email: reviewer.email,
                assignmentCount: reviewer.assignmentCount + 1,
                isAbsent: reviewer.isAbsent,
                createdAt: reviewer.createdAt,
                tags: reviewer.tags,
            }
        };
    },
});

export const undoLastAssignment = mutation({
    args: {},
    handler: async (ctx) => {
        // Get the most recent assignment
        const lastAssignment = await ctx.db
            .query("assignmentHistory")
            .withIndex("by_timestamp")
            .order("desc")
            .first();

        if (!lastAssignment) {
            return { success: false };
        }

        const reviewer = await ctx.db.get(lastAssignment.reviewerId as Id<"reviewers">);
        if (!reviewer) {
            return { success: false };
        }

        // Ensure we have a reviewer (not a tag or other document type)
        if (!('assignmentCount' in reviewer)) {
            return { success: false };
        }

        // Decrement the assignment count
        await ctx.db.patch(lastAssignment.reviewerId as Id<"reviewers">, {
            assignmentCount: Math.max(0, reviewer.assignmentCount - 1)
        });

        // Remove the assignment from history
        await ctx.db.delete(lastAssignment._id);

        // Create backup snapshot
        await createSnapshot(ctx, `Undid assignment for: ${reviewer.name}`);

        return {
            success: true,
            reviewerId: lastAssignment.reviewerId
        };
    },
});

// Tag mutations
export const addTag = mutation({
    args: {
        name: v.string(),
        color: v.string(),
        description: v.optional(v.string()),
    },
    handler: async (ctx, { name, color, description }) => {
        const tagId = await ctx.db.insert("tags", {
            name: name.trim(),
            color,
            description: description?.trim(),
            createdAt: Date.now(),
        });

        return tagId;
    },
});

export const updateTag = mutation({
    args: {
        id: v.id("tags"),
        name: v.string(),
        color: v.string(),
        description: v.optional(v.string()),
    },
    handler: async (ctx, { id, name, color, description }) => {
        const tag = await ctx.db.get(id);
        if (!tag) {
            throw new Error("Tag not found");
        }

        await ctx.db.patch(id, {
            name: name.trim(),
            color,
            description: description?.trim(),
        });

        return id;
    },
});

export const removeTag = mutation({
    args: {
        id: v.id("tags"),
    },
    handler: async (ctx, { id }) => {
        const tag = await ctx.db.get(id);
        if (!tag) {
            throw new Error("Tag not found");
        }

        // Remove tag from all reviewers
        const allReviewers = await ctx.db.query("reviewers").collect();
        const reviewersWithTag = allReviewers.filter(reviewer =>
            reviewer.tags.includes(id)
        );

        for (const reviewer of reviewersWithTag) {
            const updatedTags = reviewer.tags.filter(tagId => tagId !== id);
            await ctx.db.patch(reviewer._id, { tags: updatedTags });
        }

        // Delete the tag
        await ctx.db.delete(id);

        return { success: true };
    },
});

export const assignTagToReviewer = mutation({
    args: {
        reviewerId: v.id("reviewers"),
        tagId: v.id("tags"),
    },
    handler: async (ctx, { reviewerId, tagId }) => {
        const reviewer = await ctx.db.get(reviewerId);
        if (!reviewer) {
            throw new Error("Reviewer not found");
        }

        const tag = await ctx.db.get(tagId);
        if (!tag) {
            throw new Error("Tag not found");
        }

        // Add tag if not already present
        if (!reviewer.tags.includes(tagId)) {
            await ctx.db.patch(reviewerId, {
                tags: [...reviewer.tags, tagId]
            });
        }

        return { success: true };
    },
});

export const removeTagFromReviewer = mutation({
    args: {
        reviewerId: v.id("reviewers"),
        tagId: v.id("tags"),
    },
    handler: async (ctx, { reviewerId, tagId }) => {
        const reviewer = await ctx.db.get(reviewerId);
        if (!reviewer) {
            throw new Error("Reviewer not found");
        }

        const updatedTags = reviewer.tags.filter(t => t !== tagId);
        await ctx.db.patch(reviewerId, { tags: updatedTags });

        return { success: true };
    },
});

// Import data mutation for migrations
export const importReviewersData = mutation({
    args: {
        reviewersData: v.array(v.object({
            name: v.string(),
            email: v.string(),
            assignmentCount: v.number(),
            isAbsent: v.boolean(),
            createdAt: v.optional(v.number()),
            tags: v.optional(v.array(v.string())),
        })),
    },
    handler: async (ctx, { reviewersData }) => {
        // Clear existing reviewers
        const existingReviewers = await ctx.db.query("reviewers").collect();
        for (const reviewer of existingReviewers) {
            await ctx.db.delete(reviewer._id);
        }

        // Insert new reviewers
        for (const reviewerData of reviewersData) {
            await ctx.db.insert("reviewers", {
                name: reviewerData.name,
                email: reviewerData.email,
                assignmentCount: reviewerData.assignmentCount,
                isAbsent: reviewerData.isAbsent,
                createdAt: reviewerData.createdAt || Date.now(),
                tags: [], // We'll handle tag migration separately
            });
        }

        // Create backup snapshot
        await createSnapshot(ctx, "Imported reviewers data");

        return { success: true };
    },
});

// Helper function to get most common assignment count
function getMostCommonAssignmentCount(reviewers: Array<{
    _id: Id<"reviewers">;
    _creationTime: number;
    name: string;
    email: string;
    assignmentCount: number;
    isAbsent: boolean;
    createdAt: number;
    tags: string[];
}>): number {
    if (reviewers.length === 0) return 0;

    const countFrequency = new Map<number, number>();

    for (const reviewer of reviewers) {
        const count = reviewer.assignmentCount;
        countFrequency.set(count, (countFrequency.get(count) || 0) + 1);
    }

    let mostCommonCount = 0;
    let maxFrequency = 0;

    for (const [count, frequency] of countFrequency.entries()) {
        if (frequency > maxFrequency || (frequency === maxFrequency && count > mostCommonCount)) {
            mostCommonCount = count;
            maxFrequency = frequency;
        }
    }

    return mostCommonCount;
}

// Helper function to create backup snapshots
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createSnapshot(ctx: MutationCtx, description: string) {
    const reviewers = await ctx.db.query("reviewers").collect();

    // Map reviewers to the backup format required by schema
    const reviewersForBackup = reviewers.map(reviewer => ({
        id: reviewer._id,
        name: reviewer.name,
        email: reviewer.email,
        assignmentCount: reviewer.assignmentCount,
        isAbsent: reviewer.isAbsent,
        createdAt: reviewer.createdAt,
        tags: reviewer.tags,
    }));

    await ctx.db.insert("backups", {
        reason: description,
        reviewers: reviewersForBackup,
        createdAt: Date.now(),
    });

    // Keep only the last 20 backups
    const allBackups = await ctx.db
        .query("backups")
        .withIndex("by_created_at")
        .order("desc")
        .collect();

    if (allBackups.length > 20) {
        const backupsToDelete = allBackups.slice(20);
        for (const backup of backupsToDelete) {
            await ctx.db.delete(backup._id);
        }
    }
}
