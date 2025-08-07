import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    reviewers: defineTable({
        name: v.string(),
        email: v.string(),
        assignmentCount: v.number(),
        isAbsent: v.boolean(),
        createdAt: v.number(),
        tags: v.array(v.string()), // Store tag IDs as strings for easier migration
    }).index("by_email", ["email"]),

    tags: defineTable({
        name: v.string(),
        color: v.string(),
        description: v.optional(v.string()),
        createdAt: v.number(),
    }),

    assignmentHistory: defineTable({
        reviewerId: v.string(),
        reviewerName: v.string(),
        timestamp: v.number(),
        forced: v.boolean(),
        skipped: v.boolean(),
        isAbsentSkip: v.boolean(),
        tagId: v.optional(v.string()),
        actionBy: v.optional(v.object({
            email: v.string(),
            firstName: v.optional(v.string()),
            lastName: v.optional(v.string()),
        })),
    }).index("by_timestamp", ["timestamp"]),

    assignmentFeed: defineTable({
        lastAssigned: v.optional(v.string()), // Store just the reviewer ID
        items: v.array(v.object({
            reviewerId: v.string(),
            reviewerName: v.string(),
            timestamp: v.number(),
            forced: v.boolean(),
            skipped: v.boolean(),
            isAbsentSkip: v.boolean(),
            tagId: v.optional(v.string()),
            actionBy: v.optional(v.object({
                email: v.string(),
                firstName: v.optional(v.string()),
                lastName: v.optional(v.string()),
            })),
        })),
    }),

    backups: defineTable({
        reviewers: v.array(v.object({
            id: v.string(),
            name: v.string(),
            email: v.string(),
            assignmentCount: v.number(),
            isAbsent: v.boolean(),
            createdAt: v.number(),
            tags: v.array(v.string()),
        })),
        reason: v.string(),
        createdAt: v.number(),
    }).index("by_created_at", ["createdAt"]),
});