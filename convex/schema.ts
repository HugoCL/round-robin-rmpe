import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    teams: defineTable({
        name: v.string(),
        slug: v.string(),
        createdAt: v.optional(v.number())
    })
        .index("by_slug", ["slug"]) // enforce uniqueness at write-time
        .index("by_created_at", ["createdAt"]),
    reviewers: defineTable({
        teamId: v.optional(v.id("teams")),
        name: v.string(),
        email: v.string(),
        assignmentCount: v.number(),
        isAbsent: v.boolean(),
        createdAt: v.number(),
        tags: v.array(v.id("tags")),
    })
        .index("by_email", ["email"]) // legacy/simple lookups
        .index("by_team", ["teamId"]) // team-scoped listing
        .index("by_team_email", ["teamId", "email"]),

    tags: defineTable({
        teamId: v.optional(v.id("teams")),
        name: v.string(),
        color: v.string(),
        description: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_team", ["teamId"]),

    assignmentHistory: defineTable({
        teamId: v.optional(v.id("teams")),
        reviewerId: v.id("reviewers"),
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
    })
        .index("by_timestamp", ["timestamp"]) // legacy
        .index("by_team_timestamp", ["teamId", "timestamp"]),

    assignmentFeed: defineTable({
        teamId: v.optional(v.id("teams")),
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
    }).index("by_team", ["teamId"]),

    backups: defineTable({
        teamId: v.optional(v.id("teams")),
        reviewers: v.array(v.object({
            id: v.string(),
            name: v.string(),
            email: v.string(),
            assignmentCount: v.number(),
            isAbsent: v.boolean(),
            createdAt: v.number(),
            tags: v.array(v.id("tags")),
        })),
        reason: v.string(),
        createdAt: v.number(),
    }).index("by_created_at", ["createdAt"]).index("by_team", ["teamId"]),
});