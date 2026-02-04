import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx } from "./_generated/server";

// Helpers
async function getTeamBySlugOrThrow(
	ctx: QueryCtx | MutationCtx,
	teamSlug: string,
) {
	const team = await ctx.db
		.query("teams")
		.withIndex("by_slug", (q) => q.eq("slug", teamSlug))
		.first();
	if (!team) throw new Error("Team not found");
	return team;
}

async function findReviewerByEmail(
	ctx: QueryCtx | MutationCtx,
	teamId: Id<"teams">,
	email: string,
): Promise<Doc<"reviewers"> | null> {
	const normalizedEmail = email.toLowerCase().trim();
	if (!normalizedEmail) return null;
	let reviewer = await ctx.db
		.query("reviewers")
		.withIndex("by_team_email", (q) =>
			q.eq("teamId", teamId).eq("email", normalizedEmail),
		)
		.first();
	if (reviewer) return reviewer;

	const teamReviewers = await ctx.db
		.query("reviewers")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.collect();
	reviewer =
		teamReviewers.find((r) => r.email.toLowerCase() === normalizedEmail) ||
		null;

	return reviewer;
}

// Create team
export const createTeam = mutation({
	args: { name: v.string(), slug: v.string() },
	handler: async (ctx, { name, slug }) => {
		const existing = await ctx.db
			.query("teams")
			.withIndex("by_slug", (q) => q.eq("slug", slug))
			.first();
		if (existing) throw new Error("Slug already in use");
		const teamId = await ctx.db.insert("teams", {
			name: name.trim(),
			slug: slug.trim(),
			createdAt: Date.now(),
		});
		// Create empty feed row for team
		await ctx.db.insert("assignmentFeed", {
			teamId,
			items: [],
			lastAssigned: undefined,
		});
		return teamId;
	},
});

// Update team settings (including webhook URL)
export const updateTeamSettings = mutation({
	args: {
		teamSlug: v.string(),
		googleChatWebhookUrl: v.optional(v.string()),
	},
	handler: async (ctx, { teamSlug, googleChatWebhookUrl }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		await ctx.db.patch(team._id, {
			googleChatWebhookUrl: googleChatWebhookUrl?.trim() || undefined,
		});
		return { success: true };
	},
});

// Initialize default data
export const initializeData = mutation({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Check if we already have data for this team
		const existingReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.take(1);
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
			await ctx.db.insert("reviewers", { ...reviewer, teamId: team._id });
		}

		return { success: true, message: "Default data initialized" };
	},
});

// Reviewer mutations
export const addReviewer = mutation({
	args: {
		teamSlug: v.string(),
		name: v.string(),
		email: v.string(),
		googleChatUserId: v.optional(v.string()),
	},
	handler: async (ctx, { teamSlug, name, email, googleChatUserId }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Check if email already exists
		const existingReviewer = await ctx.db
			.query("reviewers")
			.withIndex("by_team_email", (q) =>
				q.eq("teamId", team._id).eq("email", email.toLowerCase()),
			)
			.first();

		if (existingReviewer) {
			throw new Error("Email already exists");
		}

		// Get all reviewers to find minimum assignment count
		const allReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const minCount =
			allReviewers.length > 0
				? Math.min(...allReviewers.map((r) => r.assignmentCount))
				: 0;

		const reviewerId = await ctx.db.insert("reviewers", {
			teamId: team._id,
			name: name.trim(),
			email: email.trim().toLowerCase(),
			googleChatUserId: googleChatUserId?.trim() || undefined,
			assignmentCount: minCount,
			isAbsent: false,
			createdAt: Date.now(),
			tags: [],
		});

		// Create backup snapshot
		await createSnapshot(ctx, team._id, `Added reviewer: ${name} (${email})`);

		return reviewerId;
	},
});

export const updateReviewer = mutation({
	args: {
		id: v.id("reviewers"),
		name: v.string(),
		email: v.string(),
		googleChatUserId: v.optional(v.string()),
	},
	handler: async (ctx, { id, name, email, googleChatUserId }) => {
		const reviewer = await ctx.db.get(id);
		if (!reviewer) {
			throw new Error("Reviewer not found");
		}

		// Check if email conflicts with another reviewer
		const emailConflict = await ctx.db
			.query("reviewers")
			.withIndex("by_team_email", (q) =>
				q.eq("teamId", reviewer.teamId).eq("email", email.toLowerCase()),
			)
			.filter((q) => q.neq(q.field("_id"), id))
			.first();

		if (emailConflict) {
			throw new Error("Email already exists");
		}

		await ctx.db.patch(id, {
			name: name.trim(),
			email: email.trim().toLowerCase(),
			googleChatUserId: googleChatUserId?.trim() || undefined,
		});

		// Create backup snapshot
		await createSnapshot(ctx, reviewer.teamId, `Updated reviewer: ${name}`);

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
		await createSnapshot(
			ctx,
			reviewer.teamId,
			`Removed reviewer: ${reviewer.name}`,
		);

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
			isAbsent: !isCurrentlyAbsent,
		};

		// If unmarking as absent, update assignment count to most common value
		if (isCurrentlyAbsent) {
			const allReviewers = await ctx.db
				.query("reviewers")
				.withIndex("by_team", (q) => q.eq("teamId", reviewer.teamId))
				.collect();
			const availableReviewers = allReviewers.filter(
				(r) => !r.isAbsent || r._id === id,
			);
			const mostCommonCount = getMostCommonAssignmentCount(availableReviewers);
			updateData.assignmentCount = mostCommonCount;
		}

		await ctx.db.patch(id, updateData);

		// Create backup snapshot
		const status = isCurrentlyAbsent ? "available" : "absent";
		const countMessage = isCurrentlyAbsent
			? ` and updated assignment count to ${updateData.assignmentCount}`
			: "";
		await createSnapshot(
			ctx,
			reviewer.teamId,
			`Marked ${reviewer.name} as ${status}${countMessage}`,
		);

		return { success: true };
	},
});

// Mark a reviewer as absent with optional return date/time
export const markReviewerAbsent = mutation({
	args: {
		id: v.id("reviewers"),
		absentUntil: v.optional(v.number()), // Timestamp when the reviewer is expected to return
	},
	handler: async (ctx, { id, absentUntil }) => {
		const reviewer = await ctx.db.get(id);
		if (!reviewer) {
			throw new Error("Reviewer not found");
		}

		await ctx.db.patch(id, {
			isAbsent: true,
			absentUntil: absentUntil,
		});

		// Create backup snapshot
		const returnInfo = absentUntil
			? ` (returning ${new Date(absentUntil).toISOString()})`
			: "";
		await createSnapshot(
			ctx,
			reviewer.teamId,
			`Marked ${reviewer.name} as absent${returnInfo}`,
		);

		return { success: true };
	},
});

// Mark a reviewer as available (back from absence)
export const markReviewerAvailable = mutation({
	args: {
		id: v.id("reviewers"),
	},
	handler: async (ctx, { id }) => {
		const reviewer = await ctx.db.get(id);
		if (!reviewer) {
			throw new Error("Reviewer not found");
		}

		// Get all reviewers to calculate most common assignment count
		const allReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", reviewer.teamId))
			.collect();
		const availableReviewers = allReviewers.filter(
			(r) => !r.isAbsent || r._id === id,
		);
		const mostCommonCount = getMostCommonAssignmentCount(availableReviewers);

		await ctx.db.patch(id, {
			isAbsent: false,
			absentUntil: undefined,
			assignmentCount: mostCommonCount,
		});

		// Create backup snapshot
		await createSnapshot(
			ctx,
			reviewer.teamId,
			`Marked ${reviewer.name} as available and updated assignment count to ${mostCommonCount}`,
		);

		return { success: true };
	},
});

// Auto-mark reviewers as available when their absentUntil time has passed
export const processAbsentReturns = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// Optimized: Use index to filter only absent reviewers directly in DB
		// This avoids fetching all reviewers (which was causing high bandwidth usage)
		// Filter requires absentUntil to be defined (not undefined/null) AND <= now
		// This ensures reviewers with indefinite absence (absentUntil = undefined) are not auto-returned
		const absentReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_absent_until", (q) => q.eq("isAbsent", true))
			.filter((q) =>
				q.and(
					q.neq(q.field("absentUntil"), undefined),
					q.lte(q.field("absentUntil"), now),
				),
			)
			.collect();

		for (const reviewer of absentReviewers) {
			// Get all reviewers in the same team to calculate most common assignment count
			const teamReviewers = await ctx.db
				.query("reviewers")
				.withIndex("by_team", (q) => q.eq("teamId", reviewer.teamId))
				.collect();
			const availableReviewers = teamReviewers.filter(
				(r) => !r.isAbsent || r._id === reviewer._id,
			);
			const mostCommonCount = getMostCommonAssignmentCount(availableReviewers);

			await ctx.db.patch(reviewer._id, {
				isAbsent: false,
				absentUntil: undefined,
				assignmentCount: mostCommonCount,
			});

			// Create backup snapshot
			await createSnapshot(
				ctx,
				reviewer.teamId,
				`Auto-marked ${reviewer.name} as available (return time reached) and updated assignment count to ${mostCommonCount}`,
			);
		}

		return { processed: absentReviewers.length };
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
		await createSnapshot(
			ctx,
			reviewer.teamId,
			`Updated count for ${reviewer.name} to ${count}`,
		);

		return { success: true };
	},
});

export const resetAllCounts = mutation({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const allReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();

		// Reset all reviewer counts
		for (const reviewer of allReviewers) {
			await ctx.db.patch(reviewer._id, { assignmentCount: 0 });
		}

		// Clear assignment history
		const allHistory = await ctx.db
			.query("assignmentHistory")
			.withIndex("by_team_timestamp", (q) => q.eq("teamId", team._id))
			.collect();
		for (const history of allHistory) {
			await ctx.db.delete(history._id);
		}

		// Reset assignment feed
		const assignmentFeed = await ctx.db
			.query("assignmentFeed")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.first();
		if (assignmentFeed) {
			await ctx.db.patch(assignmentFeed._id, {
				items: [],
				lastAssigned: undefined,
			});
		}

		// Create backup snapshot
		await createSnapshot(ctx, team._id, "Reset all assignment counts");

		return { success: true };
	},
});

// Helper function to clean up old assignments (keep only last 100 per team)
async function cleanupOldAssignments(
	ctx: MutationCtx,
	teamId: Id<"teams"> | undefined,
) {
	const teamAssignments = await ctx.db
		.query("assignmentHistory")
		.withIndex("by_team_timestamp", (q) => q.eq("teamId", teamId))
		.order("desc")
		.collect();

	// If we have more than 100 assignments for this team, delete the oldest ones
	if (teamAssignments.length > 100) {
		const assignmentsToDelete = teamAssignments.slice(100);
		for (const assignment of assignmentsToDelete) {
			await ctx.db.delete(assignment._id);
		}
	}
}

// Helper function to update the assignment feed
async function updateAssignmentFeed(
	ctx: MutationCtx,
	newAssignment: {
		reviewerId: string;
		timestamp: number;
		forced: boolean;
		skipped: boolean;
		isAbsentSkip: boolean;
		prUrl?: string;
		contextUrl?: string;
		tagId?: string;
		actionByReviewerId?: Id<"reviewers">;
	},
	teamId: Id<"teams"> | undefined,
) {
	// Get existing feed
	const existingFeed = await ctx.db
		.query("assignmentFeed")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.first();

	if (existingFeed) {
		// Update existing feed
		const updatedItems = [newAssignment, ...(existingFeed.items || [])].slice(
			0,
			5,
		); // Keep only last 5 assignments

		await ctx.db.patch(existingFeed._id, {
			items: updatedItems,
			lastAssigned: newAssignment.reviewerId, // Store just the reviewer ID
		});
	} else {
		// Create new feed
		await ctx.db.insert("assignmentFeed", {
			teamId,
			items: [newAssignment],
			lastAssigned: newAssignment.reviewerId, // Store just the reviewer ID
		});
	}
}

// Helper function to update assignment feed after undo
async function updateAssignmentFeedAfterUndo(
	ctx: MutationCtx,
	teamId: Id<"teams"> | undefined,
) {
	// Get the current assignment feed
	const existingFeed = await ctx.db
		.query("assignmentFeed")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.first();

	if (!existingFeed) {
		return; // No feed to update
	}

	// Get the remaining assignment history to rebuild the feed
	const remainingHistory = await ctx.db
		.query("assignmentHistory")
		.withIndex("by_team_timestamp", (q) => q.eq("teamId", teamId))
		.order("desc")
		.take(5);

	// Update the feed with the remaining assignments
	const newLastAssigned =
		remainingHistory.length > 0 ? remainingHistory[0].reviewerId : undefined;

	const newItems = remainingHistory.map((item) => ({
		reviewerId: item.reviewerId,
		timestamp: item.timestamp,
		forced: item.forced,
		skipped: item.skipped,
		isAbsentSkip: item.isAbsentSkip,
		prUrl: item.prUrl,
		tagId: item.tagId,
		actionByReviewerId: item.actionByReviewerId,
	}));

	await ctx.db.patch(existingFeed._id, {
		items: newItems,
		lastAssigned: newLastAssigned, // Store just the reviewer ID
	});
}

// Assignment mutations
export const assignPR = mutation({
	args: {
		reviewerId: v.id("reviewers"),
		forced: v.optional(v.boolean()),
		skipped: v.optional(v.boolean()),
		isAbsentSkip: v.optional(v.boolean()),
		prUrl: v.optional(v.string()),
		contextUrl: v.optional(v.string()),
		tagId: v.optional(v.id("tags")),
		actionByReviewerId: v.optional(v.id("reviewers")),
	},
	handler: async (
		ctx,
		{
			reviewerId,
			forced = false,
			skipped = false,
			isAbsentSkip = false,
			prUrl,
			contextUrl,
			tagId,
			actionByReviewerId,
		},
	) => {
		const reviewer = await ctx.db.get(reviewerId);
		if (!reviewer) {
			throw new Error("Reviewer not found");
		}

		// Increment assignment count
		await ctx.db.patch(reviewerId, {
			assignmentCount: reviewer.assignmentCount + 1,
		});

		const timestamp = Date.now();

		// Add to assignment history
		await ctx.db.insert("assignmentHistory", {
			teamId: reviewer.teamId,
			reviewerId,
			timestamp,
			forced,
			skipped,
			isAbsentSkip,
			prUrl,
			contextUrl,
			tagId,
			actionByReviewerId,
		});

		// Update assignment feed - only if it's not an absent reviewer being auto-skipped
		if (!isAbsentSkip) {
			await updateAssignmentFeed(
				ctx,
				{
					reviewerId,
					timestamp,
					forced,
					skipped,
					isAbsentSkip,
					prUrl,
					contextUrl,
					tagId,
					actionByReviewerId,
				},
				reviewer.teamId,
			);
		}

		// Clean up old assignment history (keep only last 100 assignments per team)
		await cleanupOldAssignments(ctx, reviewer.teamId);

		// Create backup snapshot
		let action = "Assigned PR to";
		if (skipped) action = "Skipped";
		if (isAbsentSkip) action = "Auto-skipped absent reviewer";

		const tagName = tagId ? (await ctx.db.get(tagId))?.name : undefined;
		const tagMessage = tagName ? ` (${tagName} track)` : "";

		await createSnapshot(
			ctx,
			reviewer.teamId,
			`${action}: ${reviewer.name}${tagMessage}`,
		);

		return {
			success: true,
			reviewer: {
				id: reviewer._id,
				name: reviewer.name,
				email: reviewer.email,
				assignmentCount: reviewer.assignmentCount + 1,
				isAbsent: reviewer.isAbsent,
				createdAt: reviewer.createdAt,
				tags: reviewer.tags,
			},
		};
	},
});

// Create an active PR assignment row (called from UI after assignPR succeeds)
export const createActivePRAssignment = mutation({
	args: {
		teamSlug: v.string(),
		assigneeId: v.id("reviewers"),
		assignerId: v.id("reviewers"),
		prUrl: v.optional(v.string()),
	},
	handler: async (ctx, { teamSlug, assigneeId, assignerId, prUrl }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Basic validation: ensure reviewers exist
		const assignee = await ctx.db.get(assigneeId);
		const assigner = await ctx.db.get(assignerId);
		if (!assignee || !assigner) throw new Error("Reviewer(s) not found");
		const now = Date.now();
		const id = await ctx.db.insert("prAssignments", {
			teamId: team._id,
			prUrl: prUrl?.trim(),
			assigneeId,
			assignerId,
			status: "pending",
			createdAt: now,
			updatedAt: now,
		});
		return { success: true, id };
	},
});

// Complete an assignment (either assignee or assigner can complete directly now)
export const completePRAssignment = mutation({
	args: { id: v.id("prAssignments"), reviewerId: v.id("reviewers") },
	handler: async (ctx, { id, reviewerId }) => {
		const row = await ctx.db.get(id);
		if (!row) throw new Error("Assignment not found");
		// Allow either party related to the assignment to complete it
		if (row.assigneeId !== reviewerId && row.assignerId !== reviewerId) {
			throw new Error("Not participant");
		}
		// Regardless of current status just delete (treat any existing rows as pending)
		await ctx.db.delete(id);
		return { success: true };
	},
});

export const undoLastAssignment = mutation({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Get the most recent assignment
		const lastAssignment = await ctx.db
			.query("assignmentHistory")
			.withIndex("by_team_timestamp", (q) => q.eq("teamId", team._id))
			.order("desc")
			.first();

		if (!lastAssignment) {
			return { success: false };
		}

		const reviewer = await ctx.db.get(
			lastAssignment.reviewerId as Id<"reviewers">,
		);
		if (!reviewer) {
			return { success: false };
		}

		// Ensure we have a reviewer (not a tag or other document type)
		if (!("assignmentCount" in reviewer)) {
			return { success: false };
		}

		// Decrement the assignment count
		await ctx.db.patch(lastAssignment.reviewerId as Id<"reviewers">, {
			assignmentCount: Math.max(0, reviewer.assignmentCount - 1),
		});

		// Remove the assignment from history
		await ctx.db.delete(lastAssignment._id);

		// Update the assignment feed
		await updateAssignmentFeedAfterUndo(ctx, reviewer.teamId);

		// Create backup snapshot
		await createSnapshot(
			ctx,
			reviewer.teamId,
			`Undid assignment for: ${reviewer.name}`,
		);

		return {
			success: true,
			reviewerId: lastAssignment.reviewerId,
		};
	},
});

// Tag mutations
export const addTag = mutation({
	args: {
		teamSlug: v.string(),
		name: v.string(),
		color: v.string(),
		description: v.optional(v.string()),
	},
	handler: async (ctx, { teamSlug, name, color, description }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const tagId = await ctx.db.insert("tags", {
			teamId: team._id,
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
		const allReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", tag.teamId))
			.collect();
		const reviewersWithTag = allReviewers.filter((reviewer) =>
			reviewer.tags.includes(id),
		);

		for (const reviewer of reviewersWithTag) {
			const updatedTags = reviewer.tags.filter((tagId) => tagId !== id);
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
				tags: [...reviewer.tags, tagId],
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

		const updatedTags = reviewer.tags.filter((t) => t !== tagId);
		await ctx.db.patch(reviewerId, { tags: updatedTags });

		return { success: true };
	},
});

// Import data mutation for migrations
export const importReviewersData = mutation({
	args: {
		teamSlug: v.string(),
		reviewersData: v.array(
			v.object({
				name: v.string(),
				email: v.string(),
				assignmentCount: v.number(),
				isAbsent: v.boolean(),
				createdAt: v.optional(v.number()),
				tags: v.optional(v.array(v.string())),
				googleChatUserId: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, { teamSlug, reviewersData }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Clear existing reviewers
		const existingReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		for (const reviewer of existingReviewers) {
			await ctx.db.delete(reviewer._id);
		}

		// Insert new reviewers
		for (const reviewerData of reviewersData) {
			await ctx.db.insert("reviewers", {
				teamId: team._id,
				name: reviewerData.name,
				email: reviewerData.email,
				googleChatUserId: reviewerData.googleChatUserId,
				assignmentCount: reviewerData.assignmentCount,
				isAbsent: reviewerData.isAbsent,
				createdAt: reviewerData.createdAt || Date.now(),
				tags: [], // We'll handle tag migration separately
			});
		}

		// Create backup snapshot
		await createSnapshot(ctx, team._id, "Imported reviewers data");

		return { success: true };
	},
});

// Helper function to get most common assignment count
function getMostCommonAssignmentCount(
	reviewers: Array<{
		_id: Id<"reviewers">;
		_creationTime: number;
		name: string;
		email: string;
		assignmentCount: number;
		isAbsent: boolean;
		createdAt: number;
		tags: string[];
	}>,
): number {
	if (reviewers.length === 0) return 0;

	const countFrequency = new Map<number, number>();

	for (const reviewer of reviewers) {
		const count = reviewer.assignmentCount;
		countFrequency.set(count, (countFrequency.get(count) || 0) + 1);
	}

	let mostCommonCount = 0;
	let maxFrequency = 0;

	for (const [count, frequency] of countFrequency.entries()) {
		if (
			frequency > maxFrequency ||
			(frequency === maxFrequency && count > mostCommonCount)
		) {
			mostCommonCount = count;
			maxFrequency = frequency;
		}
	}

	return mostCommonCount;
}

// Helper function to create backup snapshots
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createSnapshot(
	ctx: MutationCtx,
	teamId: Id<"teams"> | undefined,
	description: string,
) {
	const reviewers = await ctx.db
		.query("reviewers")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.collect();

	// Map reviewers to the backup format required by schema
	const reviewersForBackup = reviewers.map((reviewer) => ({
		id: reviewer._id,
		name: reviewer.name,
		email: reviewer.email,
		googleChatUserId: reviewer.googleChatUserId,
		assignmentCount: reviewer.assignmentCount,
		isAbsent: reviewer.isAbsent,
		createdAt: reviewer.createdAt,
		tags: reviewer.tags,
	}));

	await ctx.db.insert("backups", {
		teamId,
		reason: description,
		reviewers: reviewersForBackup,
		createdAt: Date.now(),
	});

	// Keep only the last 20 backups
	const allBackups = await ctx.db
		.query("backups")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.order("desc")
		.collect();

	if (allBackups.length > 20) {
		const backupsToDelete = allBackups.slice(20);
		for (const backup of backupsToDelete) {
			await ctx.db.delete(backup._id);
		}
	}
}

// Restore from backup snapshot
export const restoreFromBackup = mutation({
	args: { teamSlug: v.string(), backupId: v.id("backups") },
	handler: async (ctx, { teamSlug, backupId }) => {
		try {
			const team = await getTeamBySlugOrThrow(ctx, teamSlug);
			// Get the backup data
			const backup = await ctx.db.get(backupId);
			if (!backup) {
				return { success: false, error: "Backup not found" };
			}
			if (backup.teamId !== team._id) {
				return { success: false, error: "Backup does not belong to this team" };
			}

			// Clear existing reviewers
			const existingReviewers = await ctx.db
				.query("reviewers")
				.withIndex("by_team", (q) => q.eq("teamId", team._id))
				.collect();
			for (const reviewer of existingReviewers) {
				await ctx.db.delete(reviewer._id);
			}

			// Clear existing assignment feed
			const existingFeed = await ctx.db
				.query("assignmentFeed")
				.withIndex("by_team", (q) => q.eq("teamId", team._id))
				.first();
			if (existingFeed) await ctx.db.delete(existingFeed._id);

			// Restore reviewers from backup
			for (const reviewerData of backup.reviewers) {
				await ctx.db.insert("reviewers", {
					teamId: team._id,
					name: reviewerData.name,
					email: reviewerData.email,
					googleChatUserId: reviewerData.googleChatUserId,
					assignmentCount: reviewerData.assignmentCount,
					isAbsent: reviewerData.isAbsent,
					createdAt: reviewerData.createdAt,
					tags: reviewerData.tags,
				});
			}

			// Create initial assignment feed
			await ctx.db.insert("assignmentFeed", {
				teamId: team._id,
				items: [],
				lastAssigned: undefined,
			});

			// Create a new backup to record this restore action
			await createSnapshot(
				ctx,
				team._id,
				`Restored from backup: ${backup.reason}`,
			);

			return { success: true };
		} catch (error) {
			console.error("Error restoring from backup:", error);
			return { success: false, error: "Failed to restore from backup" };
		}
	},
});

// ============================================
// EVENT MUTATIONS
// ============================================

// Create a new team event
export const createEvent = mutation({
	args: {
		teamSlug: v.string(),
		title: v.string(),
		description: v.optional(v.string()),
		scheduledAt: v.number(),
		createdBy: v.object({
			email: v.string(),
			name: v.string(),
			googleChatUserId: v.optional(v.string()),
		}),
	},
	handler: async (
		ctx,
		{ teamSlug, title, description, scheduledAt, createdBy },
	) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const createdByEmail = createdBy.email.toLowerCase().trim();
		const createdByReviewer = await findReviewerByEmail(
			ctx,
			team._id,
			createdByEmail,
		);

		if (!createdByReviewer) {
			return { success: false, error: "Creator must be a reviewer" };
		}

		const createdByRecord = { reviewerId: createdByReviewer._id };
		const participantRecord = {
			reviewerId: createdByReviewer._id,
			joinedAt: Date.now(),
		};

		const eventId = await ctx.db.insert("events", {
			teamId: team._id,
			title: title.trim(),
			description: description?.trim(),
			scheduledAt,
			createdAt: Date.now(),
			createdBy: createdByRecord,
			// Add the creator as the initial participant so they appear joined by default
			participants: [participantRecord],
			status: "scheduled",
		});

		return { success: true, eventId };
	},
});

// Join an event as a participant
export const joinEvent = mutation({
	args: {
		eventId: v.id("events"),
		participant: v.object({
			email: v.string(),
			name: v.string(),
			googleChatUserId: v.optional(v.string()),
		}),
	},
	handler: async (ctx, { eventId, participant }) => {
		const event = await ctx.db.get(eventId);
		if (!event) {
			return { success: false, error: "Event not found" };
		}

		if (event.status === "cancelled" || event.status === "completed") {
			return { success: false, error: "Event is no longer active" };
		}

		const normalizedEmail = participant.email.toLowerCase().trim();
		const reviewer = await findReviewerByEmail(
			ctx,
			event.teamId,
			normalizedEmail,
		);
		const reviewerId = reviewer?._id;

		if (!reviewerId) {
			return { success: false, error: "Reviewer not found" };
		}

		// Check if already participating
		const alreadyJoined = event.participants.some((p) => {
			if (p.reviewerId === reviewerId) return true;
			return false;
		});

		if (alreadyJoined) {
			return {
				success: false,
				error: "Already participating",
				alreadyJoined: true,
			};
		}

		// Add participant
		const newParticipant = { reviewerId, joinedAt: Date.now() };
		await ctx.db.patch(eventId, {
			participants: [...event.participants, newParticipant],
		});

		return { success: true };
	},
});

// Leave an event
export const leaveEvent = mutation({
	args: {
		eventId: v.id("events"),
		email: v.string(),
	},
	handler: async (ctx, { eventId, email }) => {
		const event = await ctx.db.get(eventId);
		if (!event) {
			return { success: false, error: "Event not found" };
		}

		if (event.status === "cancelled" || event.status === "completed") {
			return { success: false, error: "Event is no longer active" };
		}

		const normalizedEmail = email.toLowerCase().trim();
		const reviewer = await findReviewerByEmail(
			ctx,
			event.teamId,
			normalizedEmail,
		);
		const reviewerId = reviewer?._id;

		if (!reviewerId) {
			return { success: false, error: "Reviewer not found" };
		}

		// Remove participant
		await ctx.db.patch(eventId, {
			participants: event.participants.filter((p) => {
				if (p.reviewerId === reviewerId) return false;
				return true;
			}),
		});

		return { success: true };
	},
});

// Cancel an event
export const cancelEvent = mutation({
	args: {
		eventId: v.id("events"),
	},
	handler: async (ctx, { eventId }) => {
		const event = await ctx.db.get(eventId);
		if (!event) {
			return { success: false, error: "Event not found" };
		}

		await ctx.db.patch(eventId, {
			status: "cancelled",
		});

		return { success: true };
	},
});

export const cleanupOldRecords = mutation({
	args: {},
	handler: async (ctx) => {
		const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
		const cutoffTimestamp = Date.now() - SEVEN_DAYS_MS;

		// Clean up old prAssignments (based on createdAt)
		const oldPrAssignments = await ctx.db
			.query("prAssignments")
			.filter((q) => q.lt(q.field("createdAt"), cutoffTimestamp))
			.collect();

		for (const assignment of oldPrAssignments) {
			await ctx.db.delete(assignment._id);
		}

		// Clean up old assignmentHistory (based on timestamp)
		const oldAssignmentHistory = await ctx.db
			.query("assignmentHistory")
			.withIndex("by_timestamp", (q) => q.lt("timestamp", cutoffTimestamp))
			.collect();

		for (const history of oldAssignmentHistory) {
			await ctx.db.delete(history._id);
		}

		return {
			deletedPrAssignments: oldPrAssignments.length,
			deletedAssignmentHistory: oldAssignmentHistory.length,
		};
	},
});

// Mark event as started (called by cron or manually)
export const startEvent = mutation({
	args: {
		eventId: v.id("events"),
	},
	handler: async (ctx, { eventId }) => {
		const event = await ctx.db.get(eventId);
		if (!event) {
			return { success: false, error: "Event not found" };
		}

		if (event.status !== "scheduled") {
			return { success: false, error: "Event cannot be started" };
		}

		// Calculate expected end time for optimization
		const now = Date.now();
		const durationMinutes =
			event.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES;
		const expectedEndTime = now + durationMinutes * 60 * 1000;

		await ctx.db.patch(eventId, {
			status: "started",
			expectedEndTime, // Precalculate end time for efficient queries
		});

		return { success: true };
	},
});

// Mark event as completed
export const completeEvent = mutation({
	args: {
		eventId: v.id("events"),
	},
	handler: async (ctx, { eventId }) => {
		const event = await ctx.db.get(eventId);
		if (!event) {
			return { success: false, error: "Event not found" };
		}

		await ctx.db.patch(eventId, {
			status: "completed",
		});

		return { success: true };
	},
});

// Default duration in minutes for events
const DEFAULT_EVENT_DURATION_MINUTES = 20;

// Auto-complete events that have exceeded their duration (called by cron)
export const autoCompleteExpiredEvents = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// Optimized: Use composite index to filter directly in DB instead of fetching all started events
		// Only fetch events that are started AND have reached their expected end time
		const expiredEvents = await ctx.db
			.query("events")
			.withIndex("by_status_end_time", (q) => q.eq("status", "started"))
			.filter((q) => q.lte(q.field("expectedEndTime"), now))
			.collect();

		for (const event of expiredEvents) {
			await ctx.db.patch(event._id, {
				status: "completed",
				expectedEndTime: undefined, // Clean up the field
			});
		}

		return { completedCount: expiredEvents.length };
	},
});

// Mark invite notification as sent
export const markEventInviteSent = mutation({
	args: {
		eventId: v.id("events"),
	},
	handler: async (ctx, { eventId }) => {
		await ctx.db.patch(eventId, {
			inviteSentAt: Date.now(),
		});
		return { success: true };
	},
});

// Mark start notification as sent
export const markEventStartNotificationSent = mutation({
	args: {
		eventId: v.id("events"),
	},
	handler: async (ctx, { eventId }) => {
		await ctx.db.patch(eventId, {
			startNotificationSentAt: Date.now(),
		});
		return { success: true };
	},
});

// Add a team member as event participant by reviewer ID
export const addEventParticipant = mutation({
	args: {
		eventId: v.id("events"),
		reviewerId: v.id("reviewers"),
	},
	handler: async (ctx, { eventId, reviewerId }) => {
		const event = await ctx.db.get(eventId);
		if (!event) {
			return { success: false, error: "Event not found" };
		}

		if (event.status === "cancelled" || event.status === "completed") {
			return { success: false, error: "Event is no longer active" };
		}

		// Get the reviewer details
		const reviewer = await ctx.db.get(reviewerId);
		if (!reviewer) {
			return { success: false, error: "Reviewer not found" };
		}

		// Verify reviewer belongs to the same team
		if (reviewer.teamId !== event.teamId) {
			return { success: false, error: "Reviewer not in this team" };
		}

		// Check if already participating
		const alreadyJoined = event.participants.some(
			(p) => p.reviewerId === reviewerId,
		);

		if (alreadyJoined) {
			return {
				success: false,
				error: "Already participating",
				alreadyJoined: true,
			};
		}

		// Add participant with reviewer reference
		await ctx.db.patch(eventId, {
			participants: [
				...event.participants,
				{
					reviewerId,
					joinedAt: Date.now(),
				},
			],
		});

		return { success: true, addedName: reviewer.name };
	},
});

// Log a sent Google Chat message for debugging (keep only last 3)
export const logSentMessage = mutation({
	args: {
		text: v.string(),
		reviewerName: v.optional(v.string()),
		reviewerEmail: v.optional(v.string()),
		assignerName: v.optional(v.string()),
		assignerEmail: v.optional(v.string()),
		prUrl: v.optional(v.string()),
		teamSlug: v.optional(v.string()),
		locale: v.optional(v.string()),
		isCustom: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		// Insert new message
		await ctx.db.insert("debugMessages", {
			...args,
			createdAt: Date.now(),
		});

		// Retrieve all messages ordered by newest first
		const all = await ctx.db
			.query("debugMessages")
			.withIndex("by_created_at")
			.order("desc")
			.collect();

		if (all.length > 3) {
			const toDelete = all.slice(3); // keep first 3
			for (const doc of toDelete) {
				await ctx.db.delete(doc._id);
			}
		}
		return { success: true };
	},
});

// ============================================
// PUSH NOTIFICATION SUBSCRIPTIONS
// ============================================

// Save a push notification subscription for a user
export const savePushSubscription = mutation({
	args: {
		email: v.string(),
		subscription: v.object({
			endpoint: v.string(),
			keys: v.object({
				p256dh: v.string(),
				auth: v.string(),
			}),
		}),
	},
	handler: async (ctx, { email, subscription }) => {
		const normalizedEmail = email.toLowerCase().trim();

		// Check if this endpoint already exists
		const existing = await ctx.db
			.query("pushSubscriptions")
			.withIndex("by_endpoint", (q) => q.eq("endpoint", subscription.endpoint))
			.first();

		if (existing) {
			// Update existing subscription if email changed
			if (existing.email !== normalizedEmail) {
				await ctx.db.patch(existing._id, {
					email: normalizedEmail,
					keys: subscription.keys,
				});
			}
			return { success: true, id: existing._id };
		}

		// Create new subscription
		const id = await ctx.db.insert("pushSubscriptions", {
			email: normalizedEmail,
			endpoint: subscription.endpoint,
			keys: subscription.keys,
			createdAt: Date.now(),
		});

		return { success: true, id };
	},
});

// Remove a push subscription by endpoint
export const removePushSubscription = mutation({
	args: {
		endpoint: v.string(),
	},
	handler: async (ctx, { endpoint }) => {
		const subscription = await ctx.db
			.query("pushSubscriptions")
			.withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
			.first();

		if (subscription) {
			await ctx.db.delete(subscription._id);
		}

		return { success: true };
	},
});

// Get all push subscriptions for an email (internal query helper)
export const getPushSubscriptionsByEmail = mutation({
	args: { email: v.string() },
	handler: async (ctx, { email }) => {
		const normalizedEmail = email.toLowerCase().trim();
		return await ctx.db
			.query("pushSubscriptions")
			.withIndex("by_email", (q) => q.eq("email", normalizedEmail))
			.collect();
	},
});
