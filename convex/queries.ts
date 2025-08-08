import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Helper: resolve team by slug and optionally create a default one for single-tenant upgrade
async function getTeamBySlugOrThrow(ctx: QueryCtx, teamSlug: string) {
    const team = await ctx.db.query("teams").withIndex("by_slug", q => q.eq("slug", teamSlug)).first();
    if (!team) throw new Error("Team not found");
    return team;
}

// Teams
export const getTeams = query({
    args: {},
    handler: async (ctx) => {
        const teams = await ctx.db.query("teams").order("desc").collect();
        return teams;
    },
});

export const getTeam = query({
    args: { teamSlug: v.string() },
    handler: async (ctx, { teamSlug }) => {
        const team = await ctx.db.query("teams").withIndex("by_slug", q => q.eq("slug", teamSlug)).first();
        return team ?? null;
    },
});

// Reviewer queries
export const getReviewers = query({
    args: { teamSlug: v.string() },
    handler: async (ctx, { teamSlug }) => {
        const team = await getTeamBySlugOrThrow(ctx, teamSlug);
        return await ctx.db.query("reviewers").withIndex("by_team", q => q.eq("teamId", team._id)).collect();
    },
});

export const getTags = query({
    args: { teamSlug: v.string() },
    handler: async (ctx, { teamSlug }) => {
        const team = await getTeamBySlugOrThrow(ctx, teamSlug);
        return await ctx.db.query("tags").withIndex("by_team", q => q.eq("teamId", team._id)).collect();
    },
});

export const getAssignmentFeed = query({
    args: { teamSlug: v.string() },
    handler: async (ctx, { teamSlug }) => {
        const team = await getTeamBySlugOrThrow(ctx, teamSlug);
        const feed = await ctx.db.query("assignmentFeed").withIndex("by_team", q => q.eq("teamId", team._id)).first();
        if (!feed) return { items: [], lastAssigned: null };
        return feed;
    },
});

// Get assignment history (last 10 assignments for display)
export const getAssignmentHistory = query({
    args: { teamSlug: v.string() },
    handler: async (ctx, { teamSlug }) => {
        const team = await getTeamBySlugOrThrow(ctx, teamSlug);
        const history = await ctx.db
            .query("assignmentHistory")
            .withIndex("by_team_timestamp", q => q.eq("teamId", team._id))
            .order("desc")
            .take(10);

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
    args: { teamSlug: v.string() },
    handler: async (ctx, { teamSlug }) => {
        const team = await getTeamBySlugOrThrow(ctx, teamSlug);
        const reviewers = await ctx.db
            .query("reviewers")
            .withIndex("by_team", q => q.eq("teamId", team._id))
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
    args: { teamSlug: v.string(), tagId: v.id("tags") },
    handler: async (ctx, { teamSlug, tagId }) => {
        const team = await getTeamBySlugOrThrow(ctx, teamSlug);
        const allReviewers = await ctx.db.query("reviewers").withIndex("by_team", q => q.eq("teamId", team._id)).collect();

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

// Get all backup snapshots
export const getBackups = query({
    args: { teamSlug: v.string() },
    handler: async (ctx, { teamSlug }) => {
        const team = await getTeamBySlugOrThrow(ctx, teamSlug);
        const backups = await ctx.db
            .query("backups")
            .withIndex("by_team", q => q.eq("teamId", team._id))
            .order("desc")
            .collect();

        return backups.map(backup => ({
            key: backup._id,
            description: backup.reason,
            timestamp: backup.createdAt,
        }));
    },
});
