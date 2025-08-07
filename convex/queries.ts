import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Reviewer queries
export const getReviewers = query({
    handler: async (ctx) => {
        return await ctx.db.query("reviewers").collect();
    },
});

export const getTags = query({
    handler: async (ctx) => {
        return await ctx.db.query("tags").collect();
    },
});

export const getAssignmentFeed = query({
    handler: async (ctx) => {
        const feeds = await ctx.db.query("assignmentFeed").collect();

        if (feeds.length === 0) {
            return { items: [], lastAssigned: null };
        }

        return feeds[0];
    },
});

// Get assignment history (last 50 assignments for undo functionality)
export const getAssignmentHistory = query({
    args: {},
    handler: async (ctx) => {
        const history = await ctx.db
            .query("assignmentHistory")
            .withIndex("by_timestamp")
            .order("desc")
            .take(50);

        return history.map(item => ({
            reviewerId: item.reviewerId,
            reviewerName: item.reviewerName,
            timestamp: item.timestamp,
            forced: item.forced,
            skipped: item.skipped,
            isAbsentSkip: item.isAbsentSkip,
            tag: item.tagId,
            actionBy: item.actionBy,
        }));
    },
});

// Get next reviewer for regular assignment
export const getNextReviewer = query({
    args: {},
    handler: async (ctx) => {
        const reviewers = await ctx.db
            .query("reviewers")
            .collect();

        if (reviewers.length === 0) {
            return null;
        }

        // Find available reviewers (not absent)
        const availableReviewers = reviewers.filter(r => !r.isAbsent);

        if (availableReviewers.length > 0) {
            // Find the minimum assignment count among available reviewers
            const minCount = Math.min(...availableReviewers.map(r => r.assignmentCount));

            // Get all available reviewers with the minimum count
            const candidatesWithMinCount = availableReviewers.filter(
                r => r.assignmentCount === minCount
            );

            // Sort by creation time (older first)
            const sortedCandidates = [...candidatesWithMinCount].sort(
                (a, b) => a.createdAt - b.createdAt
            );

            return sortedCandidates[0];
        }

        return null;
    },
});

// Get next reviewer by tag
export const getNextReviewerByTag = query({
    args: { tagId: v.string() },
    handler: async (ctx, { tagId }) => {
        const allReviewers = await ctx.db.query("reviewers").collect();

        // Filter for available reviewers with the specific tag
        const availableReviewers = allReviewers.filter(r =>
            !r.isAbsent && r.tags.includes(tagId)
        );

        if (availableReviewers.length === 0) {
            return null;
        }

        // Find the minimum assignment count among available reviewers
        const minCount = Math.min(...availableReviewers.map(r => r.assignmentCount));

        // Get all available reviewers with the minimum count
        const candidatesWithMinCount = availableReviewers.filter(
            r => r.assignmentCount === minCount
        );

        // Sort by creation time (older first)
        const sortedCandidates = [...candidatesWithMinCount].sort(
            (a, b) => a.createdAt - b.createdAt
        );

        return sortedCandidates[0];
    },
});

// Get reviewer by id
export const getReviewerById = query({
    args: { id: v.string() },
    handler: async (ctx, { id }) => {
        try {
            const reviewer = await ctx.db.get(id as Id<"reviewers">);

            if (!reviewer || !('email' in reviewer)) {
                return null;
            }

            return {
                id: reviewer._id,
                name: reviewer.name,
                email: reviewer.email,
                assignmentCount: reviewer.assignmentCount,
                isAbsent: reviewer.isAbsent,
                createdAt: reviewer.createdAt,
                tags: reviewer.tags,
            };
        } catch {
            return null;
        }
    },
});

// Get tag by id
export const getTagById = query({
    args: { id: v.string() },
    handler: async (ctx, { id }) => {
        try {
            const tag = await ctx.db.get(id as Id<"tags">);

            if (!tag || !('color' in tag)) {
                return null;
            }

            return {
                id: tag._id,
                name: tag.name,
                color: tag.color,
                description: tag.description,
                createdAt: tag.createdAt,
            };
        } catch {
            return null;
        }
    },
});
