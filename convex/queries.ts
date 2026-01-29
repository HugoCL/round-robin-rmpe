import { v } from "convex/values";

type EnrichedAssignment = {
	_id: Id<"prAssignments">;
	teamId: Id<"teams">;
	prUrl?: string | undefined;
	assigneeId: Id<"reviewers">;
	assignerId: Id<"reviewers">;
	status: string;
	createdAt: number;
	updatedAt: number;
	assigneeName?: string;
	assignerName?: string;
	assigneeEmail?: string;
	assignerEmail?: string;
};

import type { Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";

// Helper: resolve team by slug and optionally create a default one for single-tenant upgrade
async function getTeamBySlugOrThrow(ctx: QueryCtx, teamSlug: string) {
	const team = await ctx.db
		.query("teams")
		.withIndex("by_slug", (q) => q.eq("slug", teamSlug))
		.first();
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
		const team = await ctx.db
			.query("teams")
			.withIndex("by_slug", (q) => q.eq("slug", teamSlug))
			.first();
		return team ?? null;
	},
});

// Reviewer queries
export const getReviewers = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		return await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
	},
});

export const getTags = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		return await ctx.db
			.query("tags")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
	},
});

export const getAssignmentFeed = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const feed = await ctx.db
			.query("assignmentFeed")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.first();
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
			.withIndex("by_team_timestamp", (q) => q.eq("teamId", team._id))
			.order("desc")
			.take(10);

		return history;
	},
});

// Get next reviewer for regular assignment
export const getNextReviewer = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();

		if (reviewers.length === 0) {
			return null;
		}

		// Find available reviewers (not absent)
		const availableReviewers = reviewers.filter((r) => !r.isAbsent);

		if (availableReviewers.length > 0) {
			// Find the minimum assignment count among available reviewers
			const minCount = Math.min(
				...availableReviewers.map((r) => r.assignmentCount),
			);

			// Get all available reviewers with the minimum count
			const candidatesWithMinCount = availableReviewers.filter(
				(r) => r.assignmentCount === minCount,
			);

			// Sort by creation time (older first)
			const sortedCandidates = [...candidatesWithMinCount].sort(
				(a, b) => a.createdAt - b.createdAt,
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
		const allReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();

		// Filter for available reviewers with the specific tag
		const availableReviewers = allReviewers.filter(
			(r) => !r.isAbsent && r.tags.includes(tagId),
		);

		if (availableReviewers.length === 0) {
			return null;
		}

		// Find the minimum assignment count among available reviewers
		const minCount = Math.min(
			...availableReviewers.map((r) => r.assignmentCount),
		);

		// Get all available reviewers with the minimum count
		const candidatesWithMinCount = availableReviewers.filter(
			(r) => r.assignmentCount === minCount,
		);

		// Sort by creation time (older first)
		const sortedCandidates = [...candidatesWithMinCount].sort(
			(a, b) => a.createdAt - b.createdAt,
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

			if (!reviewer || !("email" in reviewer)) {
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

			if (!tag || !("color" in tag)) {
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
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.order("desc")
			.collect();

		return backups.map((backup) => ({
			key: backup._id,
			description: backup.reason,
			timestamp: backup.createdAt,
		}));
	},
});

// Last 3 debug messages (for troubleshooting sent chat message formatting)
export const getLastMessages = query({
	args: {},
	handler: async (ctx) => {
		const messages = await ctx.db
			.query("debugMessages")
			.withIndex("by_created_at")
			.order("desc")
			.take(3);
		return messages;
	},
});

// Active PR assignments for a reviewer (as assignee)
export const getActiveAssignmentsForReviewer = query({
	args: { teamSlug: v.string(), email: v.string() },
	handler: async (ctx, { teamSlug, email }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Find reviewer by email
		const reviewer = await ctx.db
			.query("reviewers")
			.withIndex("by_team_email", (q) =>
				q.eq("teamId", team._id).eq("email", email.toLowerCase()),
			)
			.first();
		if (!reviewer) return [];
		const rows = await ctx.db
			.query("prAssignments")
			.withIndex("by_assignee", (q) => q.eq("assigneeId", reviewer._id))
			.collect();
		const enriched: EnrichedAssignment[] = [];
		for (const row of rows) {
			if (row.teamId !== team._id) continue;
			const assignee = await ctx.db.get(row.assigneeId as Id<"reviewers">);
			const assigner = await ctx.db.get(row.assignerId as Id<"reviewers">);
			enriched.push({
				_id: row._id,
				teamId: row.teamId as Id<"teams">,
				prUrl: row.prUrl,
				assigneeId: row.assigneeId as Id<"reviewers">,
				assignerId: row.assignerId as Id<"reviewers">,
				status: "pending", // flattened model: treat existing row as pending until completion
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				assigneeName:
					assignee && "name" in assignee ? assignee.name : undefined,
				assignerName:
					assigner && "name" in assigner ? assigner.name : undefined,
				assigneeEmail:
					assignee && "email" in assignee ? assignee.email : undefined,
				assignerEmail:
					assigner && "email" in assigner ? assigner.email : undefined,
			});
		}
		return enriched;
	},
});

// Active PR assignments created by reviewer (as assigner)
export const getActiveAssignmentsByReviewer = query({
	args: { teamSlug: v.string(), email: v.string() },
	handler: async (ctx, { teamSlug, email }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Find reviewer by email
		const reviewer = await ctx.db
			.query("reviewers")
			.withIndex("by_team_email", (q) =>
				q.eq("teamId", team._id).eq("email", email.toLowerCase()),
			)
			.first();
		if (!reviewer) return [];
		const rows = await ctx.db
			.query("prAssignments")
			.withIndex("by_assigner", (q) => q.eq("assignerId", reviewer._id))
			.collect();
		const enriched: EnrichedAssignment[] = [];
		for (const row of rows) {
			if (row.teamId !== team._id) continue;
			const assignee = await ctx.db.get(row.assigneeId as Id<"reviewers">);
			const assigner = await ctx.db.get(row.assignerId as Id<"reviewers">);
			enriched.push({
				_id: row._id,
				teamId: row.teamId as Id<"teams">,
				prUrl: row.prUrl,
				assigneeId: row.assigneeId as Id<"reviewers">,
				assignerId: row.assignerId as Id<"reviewers">,
				status: "pending",
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				assigneeName:
					assignee && "name" in assignee ? assignee.name : undefined,
				assignerName:
					assigner && "name" in assigner ? assigner.name : undefined,
				assigneeEmail:
					assignee && "email" in assignee ? assignee.email : undefined,
				assignerEmail:
					assigner && "email" in assigner ? assigner.email : undefined,
			});
		}
		return enriched;
	},
});

// Get all active (scheduled or started) events for a team
export const getActiveEvents = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const events = await ctx.db
			.query("events")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();

		// Filter for active events and sort by scheduled time
		return events
			.filter((e) => e.status === "scheduled" || e.status === "started")
			.sort((a, b) => a.scheduledAt - b.scheduledAt);
	},
});

// Get upcoming events (scheduled, not yet started)
export const getUpcomingEvents = query({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const events = await ctx.db
			.query("events")
			.withIndex("by_team_status", (q) =>
				q.eq("teamId", team._id).eq("status", "scheduled"),
			)
			.collect();

		return events.sort((a, b) => a.scheduledAt - b.scheduledAt);
	},
});

// Get a single event by ID
export const getEventById = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		return await ctx.db.get(eventId);
	},
});

// Get event with team info (for join page)
export const getEventWithTeam = query({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		const event = await ctx.db.get(eventId);
		if (!event) return null;

		const team = await ctx.db.get(event.teamId);
		return {
			event,
			team: team ? { name: team.name, slug: team.slug } : null,
		};
	},
});

// Get events that need start notification (scheduled time has passed)
export const getEventsNeedingStartNotification = query({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// Optimized: Use composite index to filter directly in DB instead of in memory
		// This dramatically reduces bandwidth by only fetching events that actually need notification
		const events = await ctx.db
			.query("events")
			.withIndex("by_status_notification_scheduled", (q) =>
				q.eq("status", "scheduled").eq("startNotificationSentAt", undefined),
			)
			.filter((q) => q.lte(q.field("scheduledAt"), now))
			.collect();

		return events;
	},
});
