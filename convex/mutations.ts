import { v } from "convex/values";
import { resolveAssignmentSlots } from "../lib/assignmentResolver";
import {
	DEFAULT_TEAM_TIMEZONE,
	getReviewerAvailability,
	isValidTimezone,
	normalizePartTimeSchedule,
	resolveTeamTimezone,
} from "../lib/reviewerAvailability";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx } from "./_generated/server";
import {
	assertCanMutateTeamById,
	getMemberTeamsForEmail,
	isAdminEmail,
	normalizeEmail,
	requireIdentity,
} from "./authz";

const GLOBAL_REVIEWED_PR_COUNTER_KEY = "reviewed_pr_total";
type UserPreferenceFlags = {
	showAssignments: boolean;
	myAssignmentsOnly: boolean;
	showTags: boolean;
	showEmails: boolean;
	hideMultiAssignmentSection: boolean;
	alwaysSendGoogleChatMessage: boolean;
	enableAgentSetupExperiment: boolean;
	defaultAgentTeamSlug?: string;
};

type UserPreferencePatch = Partial<
	Omit<UserPreferenceFlags, "defaultAgentTeamSlug">
> & {
	defaultAgentTeamSlug?: string | null;
};

type AssignmentSource = "ui" | "agent";

const USER_PREFERENCE_DEFAULTS: UserPreferenceFlags = {
	showAssignments: false,
	myAssignmentsOnly: false,
	showTags: true,
	showEmails: false,
	hideMultiAssignmentSection: false,
	alwaysSendGoogleChatMessage: false,
	enableAgentSetupExperiment: false,
	defaultAgentTeamSlug: undefined,
};

const weekdayValidator = v.union(
	v.literal("monday"),
	v.literal("tuesday"),
	v.literal("wednesday"),
	v.literal("thursday"),
	v.literal("friday"),
	v.literal("saturday"),
	v.literal("sunday"),
);

const partTimeScheduleValidator = v.optional(
	v.object({
		workingDays: v.array(weekdayValidator),
	}),
);

const assignmentSourceValidator = v.optional(
	v.union(v.literal("ui"), v.literal("agent")),
);

function resolvePreferencePatch(
	patch: UserPreferencePatch,
): Partial<UserPreferenceFlags> {
	const resolved: Partial<UserPreferenceFlags> = {};
	if (typeof patch.showAssignments === "boolean") {
		resolved.showAssignments = patch.showAssignments;
	}
	if (typeof patch.myAssignmentsOnly === "boolean") {
		resolved.myAssignmentsOnly = patch.myAssignmentsOnly;
	}
	if (typeof patch.showTags === "boolean") {
		resolved.showTags = patch.showTags;
	}
	if (typeof patch.showEmails === "boolean") {
		resolved.showEmails = patch.showEmails;
	}
	if (typeof patch.hideMultiAssignmentSection === "boolean") {
		resolved.hideMultiAssignmentSection = patch.hideMultiAssignmentSection;
	}
	if (typeof patch.alwaysSendGoogleChatMessage === "boolean") {
		resolved.alwaysSendGoogleChatMessage = patch.alwaysSendGoogleChatMessage;
	}
	if (typeof patch.enableAgentSetupExperiment === "boolean") {
		resolved.enableAgentSetupExperiment = patch.enableAgentSetupExperiment;
	}
	if (patch.defaultAgentTeamSlug !== undefined) {
		resolved.defaultAgentTeamSlug =
			patch.defaultAgentTeamSlug?.trim() || undefined;
	}
	return resolved;
}

function selectLatestUserPreference(
	rows: Doc<"userPreferences">[],
): Doc<"userPreferences"> | null {
	if (rows.length === 0) return null;
	return [...rows].sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

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

async function assertCanMutateTeamBySlug(ctx: MutationCtx, teamSlug: string) {
	const team = await getTeamBySlugOrThrow(ctx, teamSlug);
	await assertCanMutateTeamById(ctx, team._id);
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

async function incrementGlobalReviewedPRCounter(ctx: MutationCtx) {
	const metrics = await ctx.db
		.query("appMetrics")
		.withIndex("by_key", (q) => q.eq("key", GLOBAL_REVIEWED_PR_COUNTER_KEY))
		.collect();

	if (metrics.length > 0) {
		const primaryMetric = metrics[0];
		await ctx.db.patch(primaryMetric._id, {
			value: primaryMetric.value + 1,
			updatedAt: Date.now(),
		});
		return;
	}

	await ctx.db.insert("appMetrics", {
		key: GLOBAL_REVIEWED_PR_COUNTER_KEY,
		value: 1,
		updatedAt: Date.now(),
	});
}

function getReviewerAvailabilityForTeam(
	reviewer: Pick<Doc<"reviewers">, "isAbsent" | "partTimeSchedule">,
	team: Pick<Doc<"teams">, "timezone"> | null,
	now: number,
) {
	const partTimeSchedule = normalizePartTimeSchedule(reviewer.partTimeSchedule);
	return {
		partTimeSchedule,
		...getReviewerAvailability(
			{
				isAbsent: reviewer.isAbsent,
				partTimeSchedule,
			},
			resolveTeamTimezone(team?.timezone),
			now,
		),
	};
}

function isReviewerEffectivelyAbsentForTeam(
	reviewer: Pick<Doc<"reviewers">, "isAbsent" | "partTimeSchedule">,
	team: Pick<Doc<"teams">, "timezone"> | null,
	now: number,
) {
	return getReviewerAvailabilityForTeam(reviewer, team, now).effectiveIsAbsent;
}

function isPartTimeReviewer(
	reviewer: Pick<Doc<"reviewers">, "partTimeSchedule">,
): boolean {
	return normalizePartTimeSchedule(reviewer.partTimeSchedule) !== undefined;
}

function getMinAssignmentCountAmongNonPartTimeReviewers(
	reviewers: Array<
		Pick<Doc<"reviewers">, "assignmentCount" | "partTimeSchedule">
	>,
): number {
	const nonPartTimeReviewers = reviewers.filter(
		(reviewer) => !isPartTimeReviewer(reviewer),
	);
	if (nonPartTimeReviewers.length === 0) {
		return 0;
	}

	return Math.min(...nonPartTimeReviewers.map((r) => r.assignmentCount));
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
			timezone: DEFAULT_TEAM_TIMEZONE,
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
		timezone: v.optional(v.string()),
	},
	handler: async (ctx, { teamSlug, googleChatWebhookUrl, timezone }) => {
		const team = await assertCanMutateTeamBySlug(ctx, teamSlug);
		const normalizedTimezone = timezone?.trim() || DEFAULT_TEAM_TIMEZONE;
		if (!isValidTimezone(normalizedTimezone)) {
			throw new Error("Invalid timezone");
		}
		await ctx.db.patch(team._id, {
			googleChatWebhookUrl: googleChatWebhookUrl?.trim() || undefined,
			timezone: normalizedTimezone,
		});
		return { success: true };
	},
});

export const bootstrapMyUserPreferences = mutation({
	args: {
		showAssignments: v.optional(v.boolean()),
		myAssignmentsOnly: v.optional(v.boolean()),
		showTags: v.optional(v.boolean()),
		showEmails: v.optional(v.boolean()),
		hideMultiAssignmentSection: v.optional(v.boolean()),
		alwaysSendGoogleChatMessage: v.optional(v.boolean()),
		enableAgentSetupExperiment: v.optional(v.boolean()),
		defaultAgentTeamSlug: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);

		const existingRows = await ctx.db
			.query("userPreferences")
			.withIndex("by_user_token_identifier", (q) =>
				q.eq("userTokenIdentifier", identity.tokenIdentifier),
			)
			.collect();
		const existing = selectLatestUserPreference(existingRows);
		if (existing) {
			for (const row of existingRows) {
				if (row._id !== existing._id) {
					await ctx.db.delete(row._id);
				}
			}
			return { success: true, created: false, id: existing._id };
		}

		const now = Date.now();
		const patch = resolvePreferencePatch(args);
		const id = await ctx.db.insert("userPreferences", {
			userTokenIdentifier: identity.tokenIdentifier,
			email: identity.email?.toLowerCase().trim() || undefined,
			...USER_PREFERENCE_DEFAULTS,
			...patch,
			createdAt: now,
			updatedAt: now,
		});

		return { success: true, created: true, id };
	},
});

export const updateMyUserPreferences = mutation({
	args: {
		showAssignments: v.optional(v.boolean()),
		myAssignmentsOnly: v.optional(v.boolean()),
		showTags: v.optional(v.boolean()),
		showEmails: v.optional(v.boolean()),
		hideMultiAssignmentSection: v.optional(v.boolean()),
		alwaysSendGoogleChatMessage: v.optional(v.boolean()),
		enableAgentSetupExperiment: v.optional(v.boolean()),
		defaultAgentTeamSlug: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);

		const existingRows = await ctx.db
			.query("userPreferences")
			.withIndex("by_user_token_identifier", (q) =>
				q.eq("userTokenIdentifier", identity.tokenIdentifier),
			)
			.collect();
		const primary = selectLatestUserPreference(existingRows);
		const now = Date.now();
		const patch = resolvePreferencePatch(args);

		if (!primary) {
			const createdId = await ctx.db.insert("userPreferences", {
				userTokenIdentifier: identity.tokenIdentifier,
				email: identity.email?.toLowerCase().trim() || undefined,
				...USER_PREFERENCE_DEFAULTS,
				...patch,
				createdAt: now,
				updatedAt: now,
			});
			return { success: true, created: true, id: createdId };
		}

		await ctx.db.patch(primary._id, {
			...patch,
			email: identity.email?.toLowerCase().trim() || undefined,
			updatedAt: now,
		});

		for (const row of existingRows) {
			if (row._id !== primary._id) {
				await ctx.db.delete(row._id);
			}
		}

		return { success: true, created: false, id: primary._id };
	},
});

// Initialize default data
export const initializeData = mutation({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await assertCanMutateTeamBySlug(ctx, teamSlug);
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
		partTimeSchedule: partTimeScheduleValidator,
	},
	handler: async (
		ctx,
		{ teamSlug, name, email, googleChatUserId, partTimeSchedule },
	) => {
		const team = await assertCanMutateTeamBySlug(ctx, teamSlug);
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

		const normalizedPartTimeSchedule =
			normalizePartTimeSchedule(partTimeSchedule);

		// Get all reviewers to find minimum assignment count
		const allReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const minCount =
			normalizedPartTimeSchedule !== undefined
				? getMinAssignmentCountAmongNonPartTimeReviewers(allReviewers)
				: allReviewers.length > 0
					? Math.min(...allReviewers.map((r) => r.assignmentCount))
					: 0;

		const reviewerId = await ctx.db.insert("reviewers", {
			teamId: team._id,
			name: name.trim(),
			email: email.trim().toLowerCase(),
			googleChatUserId: googleChatUserId?.trim() || undefined,
			assignmentCount: minCount,
			isAbsent: false,
			partTimeSchedule: normalizedPartTimeSchedule,
			createdAt: Date.now(),
			tags: [],
		});

		// Create backup snapshot
		const scheduleMessage = normalizedPartTimeSchedule
			? ` [part-time: ${normalizedPartTimeSchedule.workingDays.join(", ")}]`
			: "";
		await createSnapshot(
			ctx,
			team._id,
			`Added reviewer: ${name} (${email})${scheduleMessage}`,
		);

		return reviewerId;
	},
});

export const updateReviewer = mutation({
	args: {
		id: v.id("reviewers"),
		name: v.string(),
		email: v.string(),
		googleChatUserId: v.optional(v.string()),
		partTimeSchedule: partTimeScheduleValidator,
	},
	handler: async (
		ctx,
		{ id, name, email, googleChatUserId, partTimeSchedule },
	) => {
		const reviewer = await ctx.db.get(id);
		if (!reviewer) {
			throw new Error("Reviewer not found");
		}
		if (!reviewer.teamId) {
			throw new Error("Reviewer is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, reviewer.teamId);

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

		const normalizedPartTimeSchedule =
			normalizePartTimeSchedule(partTimeSchedule);

		await ctx.db.patch(id, {
			name: name.trim(),
			email: email.trim().toLowerCase(),
			googleChatUserId: googleChatUserId?.trim() || undefined,
			partTimeSchedule: normalizedPartTimeSchedule,
		});

		// Create backup snapshot
		const scheduleMessage = normalizedPartTimeSchedule
			? ` [part-time: ${normalizedPartTimeSchedule.workingDays.join(", ")}]`
			: " [full-time]";
		await createSnapshot(
			ctx,
			reviewer.teamId,
			`Updated reviewer: ${name}${scheduleMessage}`,
		);

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
		if (!reviewer.teamId) {
			throw new Error("Reviewer is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, reviewer.teamId);

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
		if (!reviewer.teamId) {
			throw new Error("Reviewer is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, reviewer.teamId);
		const team =
			reviewer.teamId === undefined ? null : await ctx.db.get(reviewer.teamId);
		const now = Date.now();

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
				(candidate) =>
					!isReviewerEffectivelyAbsentForTeam(candidate, team, now) ||
					candidate._id === id,
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
		if (!reviewer.teamId) {
			throw new Error("Reviewer is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, reviewer.teamId);

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
		if (!reviewer.teamId) {
			throw new Error("Reviewer is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, reviewer.teamId);
		const team =
			reviewer.teamId === undefined ? null : await ctx.db.get(reviewer.teamId);
		const now = Date.now();

		// Get all reviewers to calculate most common assignment count
		const allReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", reviewer.teamId))
			.collect();
		const availableReviewers = allReviewers.filter(
			(candidate) =>
				!isReviewerEffectivelyAbsentForTeam(candidate, team, now) ||
				candidate._id === id,
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
			const team =
				reviewer.teamId === undefined
					? null
					: await ctx.db.get(reviewer.teamId);
			// Get all reviewers in the same team to calculate most common assignment count
			const teamReviewers = await ctx.db
				.query("reviewers")
				.withIndex("by_team", (q) => q.eq("teamId", reviewer.teamId))
				.collect();
			const availableReviewers = teamReviewers.filter(
				(candidate) =>
					!isReviewerEffectivelyAbsentForTeam(candidate, team, now) ||
					candidate._id === reviewer._id,
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
		if (!reviewer.teamId) {
			throw new Error("Reviewer is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, reviewer.teamId);

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
		const team = await assertCanMutateTeamBySlug(ctx, teamSlug);
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

type AssignmentFeedItemRecord = {
	reviewerId: string;
	reviewerName?: string;
	timestamp: number;
	batchId?: string;
	forced: boolean;
	skipped: boolean;
	isAbsentSkip: boolean;
	urgent?: boolean;
	crossTeamReview?: boolean;
	source?: AssignmentSource;
	prUrl?: string;
	contextUrl?: string;
	tagId?: string;
	actionByReviewerId?: Id<"reviewers">;
	actionByName?: string;
};

function sanitizeAssignmentFeedItem(
	item: AssignmentFeedItemRecord & Record<string, unknown>,
): AssignmentFeedItemRecord {
	return {
		reviewerId: item.reviewerId,
		reviewerName:
			typeof item.reviewerName === "string" ? item.reviewerName : undefined,
		timestamp: item.timestamp,
		batchId: item.batchId,
		forced: item.forced,
		skipped: item.skipped,
		isAbsentSkip: item.isAbsentSkip,
		urgent: item.urgent === true,
		crossTeamReview: item.crossTeamReview === true,
		source: (item.source === "agent" ? "agent" : "ui") as AssignmentSource,
		prUrl: item.prUrl,
		contextUrl: item.contextUrl,
		tagId: item.tagId,
		actionByReviewerId: item.actionByReviewerId,
		actionByName:
			typeof item.actionByName === "string" ? item.actionByName : undefined,
	};
}

function sanitizeAssignmentFeedItems(
	items: Array<AssignmentFeedItemRecord & Record<string, unknown>>,
) {
	return items.map(sanitizeAssignmentFeedItem);
}

type AssignmentHistoryRecord = {
	teamId?: Id<"teams">;
	reviewerId: Id<"reviewers">;
	reviewerTeamId?: Id<"teams">;
	reviewerPoolTeamIds?: Id<"teams">[];
	timestamp: number;
	batchId?: string;
	forced: boolean;
	skipped: boolean;
	isAbsentSkip: boolean;
	urgent?: boolean;
	crossTeamReview?: boolean;
	source?: AssignmentSource;
	prUrl?: string;
	contextUrl?: string;
	googleChatThreadUrl?: string;
	tagId?: string;
	actionByReviewerId?: Id<"reviewers">;
};

function sanitizeAssignmentHistoryRecord(
	item: AssignmentHistoryRecord & Record<string, unknown>,
): AssignmentHistoryRecord {
	return {
		teamId: item.teamId,
		reviewerId: item.reviewerId,
		reviewerTeamId: item.reviewerTeamId,
		reviewerPoolTeamIds: item.reviewerPoolTeamIds,
		timestamp: item.timestamp,
		batchId: item.batchId,
		forced: item.forced,
		skipped: item.skipped,
		isAbsentSkip: item.isAbsentSkip,
		urgent: item.urgent === true,
		crossTeamReview: item.crossTeamReview === true,
		source: (item.source === "agent" ? "agent" : "ui") as AssignmentSource,
		prUrl: item.prUrl,
		contextUrl: item.contextUrl,
		googleChatThreadUrl:
			typeof item.googleChatThreadUrl === "string"
				? item.googleChatThreadUrl
				: undefined,
		tagId: item.tagId,
		actionByReviewerId: item.actionByReviewerId,
	};
}

// Helper function to update the assignment feed
async function updateAssignmentFeed(
	ctx: MutationCtx,
	newAssignment: AssignmentFeedItemRecord,
	teamId: Id<"teams"> | undefined,
) {
	// Get existing feed
	const existingFeed = await ctx.db
		.query("assignmentFeed")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.first();

	if (existingFeed) {
		// Update existing feed
		const updatedItems = sanitizeAssignmentFeedItems([
			newAssignment,
			...(existingFeed.items || []),
		]).slice(0, 5); // Keep only last 5 assignments

		await ctx.db.patch(existingFeed._id, {
			items: updatedItems,
			lastAssigned: newAssignment.reviewerId, // Store just the reviewer ID
		});
	} else {
		// Create new feed
		await ctx.db.insert("assignmentFeed", {
			teamId,
			items: [sanitizeAssignmentFeedItem(newAssignment)],
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
		reviewerName: item.reviewerName,
		timestamp: item.timestamp,
		batchId: item.batchId,
		forced: item.forced,
		skipped: item.skipped,
		isAbsentSkip: item.isAbsentSkip,
		urgent: item.urgent === true,
		crossTeamReview: item.crossTeamReview === true,
		source: (item.source === "agent" ? "agent" : "ui") as AssignmentSource,
		prUrl: item.prUrl,
		contextUrl: item.contextUrl,
		tagId: item.tagId,
		actionByReviewerId: item.actionByReviewerId,
		actionByName: item.actionByName,
	}));

	await ctx.db.patch(existingFeed._id, {
		items: newItems,
		lastAssigned: newLastAssigned, // Store just the reviewer ID
	});
}

// Assignment mutations
export const assignPRBatch = mutation({
	args: {
		teamSlug: v.string(),
		additionalTeamSlugs: v.optional(v.array(v.string())),
		mode: v.string(), // "regular" | "tag"
		selectedTagId: v.optional(v.id("tags")),
		slots: v.array(
			v.object({
				strategy: v.string(), // "random" | "specific" | "tag_random_selected" | "tag_random_other"
				reviewerId: v.optional(v.id("reviewers")),
				tagId: v.optional(v.id("tags")),
			}),
		),
		prUrl: v.optional(v.string()),
		contextUrl: v.optional(v.string()),
		urgent: v.optional(v.boolean()),
		crossTeamReview: v.optional(v.boolean()),
		excludeTeammates: v.optional(v.boolean()),
		actionByReviewerId: v.optional(v.id("reviewers")),
		source: assignmentSourceValidator,
	},
	handler: async (
		ctx,
		{
			teamSlug,
			additionalTeamSlugs = [],
			mode,
			selectedTagId,
			slots,
			prUrl,
			contextUrl,
			urgent = false,
			crossTeamReview = false,
			excludeTeammates = false,
			actionByReviewerId,
			source = "ui",
		},
	) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const normalizedAdditionalTeamSlugs = [
			...new Set(
				additionalTeamSlugs
					.map((slug) => slug.trim())
					.filter((slug) => slug.length > 0 && slug !== teamSlug),
			),
		];
		const selectedAdditionalTeams = crossTeamReview
			? await Promise.all(
					normalizedAdditionalTeamSlugs.map((slug) =>
						getTeamBySlugOrThrow(ctx, slug),
					),
				)
			: [];
		const reviewerPoolTeams =
			crossTeamReview && excludeTeammates
				? selectedAdditionalTeams
				: [team, ...selectedAdditionalTeams];
		const reviewerPoolTeamIds =
			reviewerPoolTeams.length > 0
				? reviewerPoolTeams.map((item) => item._id)
				: undefined;
		const availabilityNow = Date.now();
		const assignmentSource: AssignmentSource =
			source === "agent" ? "agent" : "ui";
		if (slots.length === 0) {
			return {
				success: false,
				assigned: [],
				failed: [{ slotIndex: 0, reason: "no_candidates" as const }],
				assignedCount: 0,
				failedCount: 1,
				totalRequested: 0,
			};
		}

		const reviewersByTeam = await Promise.all(
			reviewerPoolTeams.map(async (reviewerPoolTeam) => {
				const reviewersForTeam = await ctx.db
					.query("reviewers")
					.withIndex("by_team", (q) => q.eq("teamId", reviewerPoolTeam._id))
					.collect();
				return { reviewerPoolTeam, reviewersForTeam };
			}),
		);

		const reviewers = reviewersByTeam.flatMap(
			(entry) => entry.reviewersForTeam,
		);
		const reviewerTeamById = new Map<Id<"reviewers">, Id<"teams">>();
		const reviewerTimezoneTeamById = new Map<
			Id<"reviewers">,
			Pick<Doc<"teams">, "timezone"> | null
		>();
		for (const entry of reviewersByTeam) {
			for (const reviewer of entry.reviewersForTeam) {
				reviewerTeamById.set(reviewer._id, entry.reviewerPoolTeam._id);
				reviewerTimezoneTeamById.set(reviewer._id, entry.reviewerPoolTeam);
			}
		}

		const availabilityByReviewerId = new Map<
			Id<"reviewers">,
			{ effectiveIsAbsent: boolean; isPartTime: boolean }
		>();
		for (const reviewer of reviewers) {
			const reviewerTimezoneTeam =
				reviewerTimezoneTeamById.get(reviewer._id) ?? team;
			const availability = getReviewerAvailabilityForTeam(
				reviewer,
				reviewerTimezoneTeam,
				availabilityNow,
			);
			availabilityByReviewerId.set(reviewer._id, {
				effectiveIsAbsent: availability.effectiveIsAbsent,
				isPartTime: availability.partTimeSchedule !== undefined,
			});
		}

		const partTimeCatchUpBaseline =
			crossTeamReview && selectedAdditionalTeams.length > 0
				? 0
				: getMinAssignmentCountAmongNonPartTimeReviewers(reviewers);
		const partTimeCatchUpCountsById = new Map<Id<"reviewers">, number>();
		for (const reviewer of reviewers) {
			if (crossTeamReview && selectedAdditionalTeams.length > 0) {
				continue;
			}
			const availability = availabilityByReviewerId.get(reviewer._id);
			if (!availability) {
				continue;
			}
			if (!availability.isPartTime || availability.effectiveIsAbsent) {
				continue;
			}

			if (reviewer.assignmentCount < partTimeCatchUpBaseline) {
				await ctx.db.patch(reviewer._id, {
					assignmentCount: partTimeCatchUpBaseline,
				});
				partTimeCatchUpCountsById.set(reviewer._id, partTimeCatchUpBaseline);
			}
		}

		const reviewersForAssignment = reviewers.map((reviewer) => {
			const syncedCount = partTimeCatchUpCountsById.get(reviewer._id);
			if (syncedCount === undefined) {
				return reviewer;
			}
			return {
				...reviewer,
				assignmentCount: syncedCount,
			};
		});

		if (reviewers.length === 0) {
			return {
				success: false,
				assigned: [],
				failed: slots.map((_, slotIndex) => ({
					slotIndex,
					reason: "no_candidates" as const,
				})),
				assignedCount: 0,
				failedCount: slots.length,
				totalRequested: slots.length,
			};
		}

		const byId = new Map<Id<"reviewers">, Doc<"reviewers">>();
		for (const reviewer of reviewersForAssignment) {
			byId.set(reviewer._id, reviewer);
		}

		const resolution = resolveAssignmentSlots({
			mode: mode === "tag" ? "tag" : "regular",
			selectedTagId,
			slots,
			reviewers: reviewersForAssignment.map((reviewer) => ({
				...reviewer,
				effectiveIsAbsent:
					availabilityByReviewerId.get(reviewer._id)?.effectiveIsAbsent ??
					isReviewerEffectivelyAbsentForTeam(
						reviewer,
						reviewerTimezoneTeamById.get(reviewer._id) ?? team,
						availabilityNow,
					),
			})),
			excludedReviewerId: actionByReviewerId,
		});

		if (resolution.resolved.length === 0) {
			return {
				success: false,
				assigned: [],
				failed: resolution.failed,
				assignedCount: 0,
				failedCount: resolution.failed.length,
				totalRequested: slots.length,
			};
		}

		const now = availabilityNow;
		const batchId = `batch_${now}_${Math.random().toString(36).slice(2, 10)}`;
		const assigner = actionByReviewerId
			? byId.get(actionByReviewerId)
			: undefined;
		const feedEntries: Array<{
			reviewerId: string;
			reviewerName?: string;
			timestamp: number;
			batchId: string;
			forced: boolean;
			skipped: boolean;
			isAbsentSkip: boolean;
			urgent?: boolean;
			crossTeamReview?: boolean;
			source?: AssignmentSource;
			prUrl?: string;
			contextUrl?: string;
			tagId?: string;
			actionByReviewerId?: Id<"reviewers">;
			actionByName?: string;
		}> = [];

		const assigned = [];
		for (const [index, item] of resolution.resolved.entries()) {
			const timestamp = now + index;
			const reviewer = byId.get(item.reviewer._id);
			if (!reviewer) continue;
			const nextCount = reviewer.assignmentCount + 1;

			await ctx.db.patch(reviewer._id, {
				assignmentCount: nextCount,
			});

			await ctx.db.insert("assignmentHistory", {
				teamId: team._id,
				reviewerId: reviewer._id,
				reviewerTeamId: reviewerTeamById.get(reviewer._id),
				reviewerPoolTeamIds,
				reviewerName: reviewer.name,
				timestamp,
				batchId,
				forced: false,
				skipped: false,
				isAbsentSkip: false,
				urgent,
				crossTeamReview,
				source: assignmentSource,
				prUrl,
				contextUrl,
				tagId: item.tagId ? String(item.tagId) : undefined,
				actionByReviewerId,
				actionByName: assigner?.name,
			});

			if (assigner) {
				await ctx.db.insert("prAssignments", {
					teamId: team._id,
					reviewerTeamId: reviewerTeamById.get(reviewer._id),
					reviewerPoolTeamIds,
					prUrl: prUrl?.trim(),
					batchId,
					urgent,
					crossTeamReview,
					assigneeId: reviewer._id,
					assignerId: assigner._id,
					createdAt: timestamp,
					updatedAt: timestamp,
				});
			}

			feedEntries.push({
				reviewerId: reviewer._id,
				reviewerName: reviewer.name,
				timestamp,
				batchId,
				forced: false,
				skipped: false,
				isAbsentSkip: false,
				urgent,
				crossTeamReview,
				source: assignmentSource,
				prUrl,
				contextUrl,
				tagId: item.tagId ? String(item.tagId) : undefined,
				actionByReviewerId,
				actionByName: assigner?.name,
			});

			assigned.push({
				slotIndex: item.slotIndex,
				reviewer: {
					id: reviewer._id,
					name: reviewer.name,
					email: reviewer.email,
					assignmentCount: nextCount,
					isAbsent: reviewer.isAbsent,
					effectiveIsAbsent: item.reviewer.effectiveIsAbsent,
					createdAt: reviewer.createdAt,
					tags: reviewer.tags,
				},
				tagId: item.tagId ? String(item.tagId) : undefined,
			});
		}

		await incrementGlobalReviewedPRCounter(ctx);
		await updateAssignmentFeedBatch(ctx, feedEntries, team._id);

		await createSnapshot(
			ctx,
			team._id,
			`Assigned batch (${assigned.length}/${slots.length}): ${assigned
				.map((a) => a.reviewer.name)
				.join(", ")}`,
		);

		return {
			success: true,
			batchId,
			assigned,
			failed: resolution.failed,
			assignedCount: assigned.length,
			failedCount: resolution.failed.length,
			totalRequested: slots.length,
		};
	},
});

// Assignment mutations
export const assignPR = mutation({
	args: {
		reviewerId: v.id("reviewers"),
		forced: v.optional(v.boolean()),
		skipped: v.optional(v.boolean()),
		isAbsentSkip: v.optional(v.boolean()),
		urgent: v.optional(v.boolean()),
		crossTeamReview: v.optional(v.boolean()),
		source: assignmentSourceValidator,
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
			urgent = false,
			crossTeamReview = false,
			source = "ui",
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
		const assignmentSource: AssignmentSource =
			source === "agent" ? "agent" : "ui";

		const timestamp = Date.now();

		// Add to assignment history
		await ctx.db.insert("assignmentHistory", {
			teamId: reviewer.teamId,
			reviewerId,
			reviewerTeamId: reviewer.teamId,
			reviewerName: reviewer.name,
			timestamp,
			forced,
			skipped,
			isAbsentSkip,
			urgent,
			crossTeamReview,
			source: assignmentSource,
			prUrl,
			contextUrl,
			tagId,
			actionByReviewerId,
			actionByName: actionByReviewerId
				? (await ctx.db.get(actionByReviewerId))?.name
				: undefined,
		});

		// Increment global PR counter only for real assignments (exclude skips)
		if (!skipped && !isAbsentSkip) {
			await incrementGlobalReviewedPRCounter(ctx);
		}

		// Update assignment feed - only if it's not an absent reviewer being auto-skipped
		if (!isAbsentSkip) {
			await updateAssignmentFeed(
				ctx,
				{
					reviewerId,
					reviewerName: reviewer.name,
					timestamp,
					forced,
					skipped,
					isAbsentSkip,
					urgent,
					crossTeamReview,
					source: assignmentSource,
					prUrl,
					contextUrl,
					tagId,
					actionByReviewerId,
					actionByName: actionByReviewerId
						? (await ctx.db.get(actionByReviewerId))?.name
						: undefined,
				},
				reviewer.teamId,
			);
		}

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
		const team =
			reviewer.teamId === undefined ? null : await ctx.db.get(reviewer.teamId);

		return {
			success: true,
			reviewer: {
				id: reviewer._id,
				name: reviewer.name,
				email: reviewer.email,
				assignmentCount: reviewer.assignmentCount + 1,
				isAbsent: reviewer.isAbsent,
				effectiveIsAbsent: isReviewerEffectivelyAbsentForTeam(
					reviewer,
					team,
					timestamp,
				),
				createdAt: reviewer.createdAt,
				tags: reviewer.tags,
			},
		};
	},
});

export const attachGoogleChatThreadUrlToAssignmentHistory = mutation({
	args: {
		teamSlug: v.string(),
		prUrl: v.string(),
		reviewerEmails: v.array(v.string()),
		googleChatThreadUrl: v.string(),
	},
	handler: async (
		ctx,
		{ teamSlug, prUrl, reviewerEmails, googleChatThreadUrl },
	) => {
		const normalizedPrUrl = prUrl.trim().toLowerCase();
		const normalizedThreadUrl = googleChatThreadUrl.trim();
		const normalizedEmails = [
			...new Set(
				reviewerEmails
					.map((email) => email.toLowerCase().trim())
					.filter((email) => email.length > 0),
			),
		];

		if (
			normalizedPrUrl.length === 0 ||
			normalizedThreadUrl.length === 0 ||
			normalizedEmails.length === 0
		) {
			return { success: true, updated: 0 };
		}

		const team = await getTeamBySlugOrThrow(ctx, teamSlug);

		const reviewerRows = (
			await Promise.all(
				normalizedEmails.map((email) =>
					ctx.db
						.query("reviewers")
						.withIndex("by_email", (q) => q.eq("email", email))
						.collect(),
				),
			)
		).flat();

		const targetReviewerIds = new Set<Id<"reviewers">>(
			reviewerRows.map((row) => row._id),
		);

		if (targetReviewerIds.size === 0) {
			return { success: true, updated: 0 };
		}

		const recentHistory = await ctx.db
			.query("assignmentHistory")
			.withIndex("by_team_timestamp", (q) => q.eq("teamId", team._id))
			.order("desc")
			.take(200);

		let updated = 0;
		const updatedReviewers = new Set<Id<"reviewers">>();

		for (const row of recentHistory) {
			if (updatedReviewers.size >= targetReviewerIds.size) {
				break;
			}
			if (!targetReviewerIds.has(row.reviewerId)) {
				continue;
			}
			if (updatedReviewers.has(row.reviewerId)) {
				continue;
			}
			if ((row.prUrl?.trim().toLowerCase() || "") !== normalizedPrUrl) {
				continue;
			}
			if (row.googleChatThreadUrl?.trim()) {
				updatedReviewers.add(row.reviewerId);
				continue;
			}

			await ctx.db.patch(row._id, {
				googleChatThreadUrl: normalizedThreadUrl,
			});
			updated += 1;
			updatedReviewers.add(row.reviewerId);
		}

		return {
			success: true,
			updated,
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
		batchId: v.optional(v.string()),
		urgent: v.optional(v.boolean()),
		crossTeamReview: v.optional(v.boolean()),
	},
	handler: async (
		ctx,
		{
			teamSlug,
			assigneeId,
			assignerId,
			prUrl,
			batchId,
			urgent = false,
			crossTeamReview = false,
		},
	) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		// Basic validation: ensure reviewers exist
		const assignee = await ctx.db.get(assigneeId);
		const assigner = await ctx.db.get(assignerId);
		if (!assignee || !assigner) throw new Error("Reviewer(s) not found");
		const now = Date.now();
		const id = await ctx.db.insert("prAssignments", {
			teamId: team._id,
			reviewerTeamId: assignee.teamId,
			prUrl: prUrl?.trim(),
			batchId,
			urgent,
			crossTeamReview,
			assigneeId,
			assignerId,
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
		// Delete active assignment row on completion.
		await ctx.db.delete(id);
		return { success: true };
	},
});

// Remove legacy `status` field from historical prAssignments rows.
export const cleanupLegacyPRAssignmentStatus = mutation({
	args: {},
	handler: async (ctx) => {
		const rows = await ctx.db.query("prAssignments").collect();
		let updated = 0;

		for (const row of rows) {
			const legacyStatus =
				"status" in row
					? (row as Doc<"prAssignments"> & { status?: string }).status
					: undefined;
			if (typeof legacyStatus === "undefined") continue;

			await ctx.db.replace(row._id, {
				teamId: row.teamId,
				reviewerTeamId: row.reviewerTeamId,
				reviewerPoolTeamIds: row.reviewerPoolTeamIds,
				prUrl: row.prUrl,
				batchId: row.batchId,
				urgent: row.urgent,
				crossTeamReview: row.crossTeamReview,
				assigneeId: row.assigneeId,
				assignerId: row.assignerId,
				createdAt: row.createdAt,
				updatedAt: Date.now(),
			});
			updated += 1;
		}

		return {
			success: true,
			total: rows.length,
			updated,
		};
	},
});

export const undoLastAssignment = mutation({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await assertCanMutateTeamBySlug(ctx, teamSlug);
		const lastAssignment = await ctx.db
			.query("assignmentHistory")
			.withIndex("by_team_timestamp", (q) => q.eq("teamId", team._id))
			.order("desc")
			.first();

		if (!lastAssignment) {
			return { success: false };
		}

		if (lastAssignment.batchId) {
			const batchId = lastAssignment.batchId;
			const batchAssignments = await ctx.db
				.query("assignmentHistory")
				.withIndex("by_team_timestamp", (q) => q.eq("teamId", team._id))
				.collect();
			const rowsForBatch = batchAssignments.filter(
				(row) => row.batchId === batchId,
			);
			if (rowsForBatch.length === 0) {
				return { success: false };
			}

			const prAssignments = await ctx.db
				.query("prAssignments")
				.withIndex("by_team", (q) => q.eq("teamId", team._id))
				.collect();
			const prAssignmentsForBatch = prAssignments.filter(
				(row) => row.batchId === batchId,
			);

			const undoneReviewerNames: string[] = [];
			for (const row of rowsForBatch) {
				const reviewer = await ctx.db.get(row.reviewerId as Id<"reviewers">);
				if (!reviewer || !("assignmentCount" in reviewer)) continue;
				undoneReviewerNames.push(reviewer.name);
				await ctx.db.patch(row.reviewerId as Id<"reviewers">, {
					assignmentCount: Math.max(0, reviewer.assignmentCount - 1),
				});
				await ctx.db.delete(row._id);
			}

			for (const row of prAssignmentsForBatch) {
				await ctx.db.delete(row._id);
			}

			await updateAssignmentFeedAfterUndo(ctx, team._id);
			await createSnapshot(
				ctx,
				team._id,
				`Undid batch assignment (${rowsForBatch.length}): ${undoneReviewerNames.join(", ")}`,
			);

			return {
				success: true,
				batchId,
				undoneCount: rowsForBatch.length,
				reviewerId: lastAssignment.reviewerId,
			};
		}

		const reviewer = await ctx.db.get(
			lastAssignment.reviewerId as Id<"reviewers">,
		);
		if (!reviewer || !("assignmentCount" in reviewer)) {
			return { success: false };
		}
		await ctx.db.patch(lastAssignment.reviewerId as Id<"reviewers">, {
			assignmentCount: Math.max(0, reviewer.assignmentCount - 1),
		});
		await ctx.db.delete(lastAssignment._id);
		await updateAssignmentFeedAfterUndo(ctx, reviewer.teamId);
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
		const team = await assertCanMutateTeamBySlug(ctx, teamSlug);
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
		if (!tag.teamId) {
			throw new Error("Tag is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, tag.teamId);

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
		if (!tag.teamId) {
			throw new Error("Tag is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, tag.teamId);

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
		if (!reviewer.teamId) {
			throw new Error("Reviewer is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, reviewer.teamId);

		const tag = await ctx.db.get(tagId);
		if (!tag) {
			throw new Error("Tag not found");
		}
		if (tag.teamId !== reviewer.teamId) {
			throw new Error("Tag and reviewer team mismatch");
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
		if (!reviewer.teamId) {
			throw new Error("Reviewer is missing team assignment");
		}
		await assertCanMutateTeamById(ctx, reviewer.teamId);

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
				partTimeSchedule: partTimeScheduleValidator,
			}),
		),
	},
	handler: async (ctx, { teamSlug, reviewersData }) => {
		const team = await assertCanMutateTeamBySlug(ctx, teamSlug);
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
				partTimeSchedule: normalizePartTimeSchedule(
					reviewerData.partTimeSchedule,
				),
				createdAt: reviewerData.createdAt || Date.now(),
				tags: [], // We'll handle tag migration separately
			});
		}

		// Create backup snapshot
		await createSnapshot(ctx, team._id, "Imported reviewers data");

		return { success: true };
	},
});

export const auditReviewerTeamAssignments = mutation({
	args: {},
	handler: async (ctx) => {
		const reviewers = await ctx.db.query("reviewers").collect();
		const reviewersMissingTeam = reviewers.filter(
			(reviewer) => !reviewer.teamId,
		);

		return {
			totalReviewers: reviewers.length,
			missingTeamCount: reviewersMissingTeam.length,
			missingTeamReviewers: reviewersMissingTeam.map((reviewer) => ({
				id: reviewer._id,
				name: reviewer.name,
				email: reviewer.email,
			})),
		};
	},
});

export const assertReviewerTeamsBackfillReady = mutation({
	args: {},
	handler: async (ctx) => {
		const reviewers = await ctx.db.query("reviewers").collect();
		const missingTeamCount = reviewers.filter(
			(reviewer) => !reviewer.teamId,
		).length;
		if (missingTeamCount > 0) {
			throw new Error(
				`Backfill blocked: ${missingTeamCount} reviewers are missing teamId`,
			);
		}

		return {
			success: true,
			message: "All reviewers have team assignments",
			totalReviewers: reviewers.length,
		};
	},
});

export const backfillUserPreferenceDefaultTeamSlug = mutation({
	args: {
		dryRun: v.optional(v.boolean()),
	},
	handler: async (ctx, { dryRun = true }) => {
		const identity = await requireIdentity(ctx);
		if (!isAdminEmail(identity.email)) {
			throw new Error("Unauthorized");
		}

		const preferences = await ctx.db.query("userPreferences").collect();
		let updatedCount = 0;
		const ambiguous: Array<{ email: string; teamSlugs: string[] }> = [];
		const skippedNoEmail: string[] = [];

		for (const preference of preferences) {
			if (preference.defaultAgentTeamSlug) {
				continue;
			}

			const normalizedEmail = normalizeEmail(preference.email);
			if (!normalizedEmail) {
				skippedNoEmail.push(preference._id);
				continue;
			}

			const memberTeams = await getMemberTeamsForEmail(ctx, normalizedEmail);
			const teamSlugs = memberTeams
				.map((team) => team.slug)
				.filter((slug): slug is string => typeof slug === "string");

			if (teamSlugs.length === 1) {
				if (!dryRun) {
					await ctx.db.patch(preference._id, {
						defaultAgentTeamSlug: teamSlugs[0],
						updatedAt: Date.now(),
					});
				}
				updatedCount += 1;
				continue;
			}

			if (teamSlugs.length > 1) {
				ambiguous.push({ email: normalizedEmail, teamSlugs });
			}
		}

		return {
			success: true,
			dryRun,
			totalPreferences: preferences.length,
			updatedCount,
			ambiguousCount: ambiguous.length,
			ambiguous,
			skippedNoEmailCount: skippedNoEmail.length,
			skippedNoEmail,
		};
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
		partTimeSchedule?: {
			workingDays: (
				| "monday"
				| "tuesday"
				| "wednesday"
				| "thursday"
				| "friday"
				| "saturday"
				| "sunday"
			)[];
		};
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
		partTimeSchedule: normalizePartTimeSchedule(reviewer.partTimeSchedule),
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

// Helper function to update assignment feed with many assignments (newest first)
async function updateAssignmentFeedBatch(
	ctx: MutationCtx,
	newAssignments: AssignmentFeedItemRecord[],
	teamId: Id<"teams"> | undefined,
) {
	if (newAssignments.length === 0) return;

	const existingFeed = await ctx.db
		.query("assignmentFeed")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.first();

	if (existingFeed) {
		const updatedItems = sanitizeAssignmentFeedItems([
			...newAssignments,
			...(existingFeed.items || []),
		]).slice(0, 5);
		await ctx.db.patch(existingFeed._id, {
			items: updatedItems,
			lastAssigned: newAssignments[0].reviewerId,
		});
		return;
	}

	await ctx.db.insert("assignmentFeed", {
		teamId,
		items: sanitizeAssignmentFeedItems(newAssignments).slice(0, 5),
		lastAssigned: newAssignments[0].reviewerId,
	});
}

export const cleanupAssignmentFeedSchemaDrift = mutation({
	args: {},
	handler: async (ctx) => {
		const feeds = await ctx.db.query("assignmentFeed").collect();
		const historyRows = await ctx.db.query("assignmentHistory").collect();
		let feedUpdated = 0;
		let historyUpdated = 0;

		for (const feed of feeds) {
			const sanitizedItems = sanitizeAssignmentFeedItems(
				(feed.items || []) as Array<
					AssignmentFeedItemRecord & Record<string, unknown>
				>,
			);
			const hasSchemaDrift = feed.items.some((item) =>
				Object.keys(item).some(
					(key) =>
						![
							"reviewerId",
							"reviewerName",
							"timestamp",
							"batchId",
							"forced",
							"skipped",
							"isAbsentSkip",
							"urgent",
							"crossTeamReview",
							"prUrl",
							"contextUrl",
							"tagId",
							"actionByReviewerId",
							"actionByName",
							"source",
						].includes(key),
				),
			);

			if (!hasSchemaDrift) continue;

			await ctx.db.replace(feed._id, {
				teamId: feed.teamId,
				lastAssigned: feed.lastAssigned,
				items: sanitizedItems,
			});
			feedUpdated += 1;
		}

		for (const row of historyRows) {
			const hasSchemaDrift = Object.keys(row).some((key) =>
				["reviewerName", "actionByName", "actionByEmail"].includes(key),
			);

			if (!hasSchemaDrift) continue;

			await ctx.db.replace(
				row._id,
				sanitizeAssignmentHistoryRecord(
					row as AssignmentHistoryRecord & Record<string, unknown>,
				),
			);
			historyUpdated += 1;
		}

		return {
			success: true,
			feedTotal: feeds.length,
			feedUpdated,
			historyTotal: historyRows.length,
			historyUpdated,
		};
	},
});

// Restore from backup snapshot
export const restoreFromBackup = mutation({
	args: { teamSlug: v.string(), backupId: v.id("backups") },
	handler: async (ctx, { teamSlug, backupId }) => {
		try {
			const team = await assertCanMutateTeamBySlug(ctx, teamSlug);
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
					partTimeSchedule: normalizePartTimeSchedule(
						reviewerData.partTimeSchedule,
					),
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
		const team = await assertCanMutateTeamBySlug(ctx, teamSlug);
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
		await assertCanMutateTeamById(ctx, event.teamId);

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
		await assertCanMutateTeamById(ctx, event.teamId);

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
		await assertCanMutateTeamById(ctx, event.teamId);

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
		await assertCanMutateTeamById(ctx, event.teamId);

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
		await assertCanMutateTeamById(ctx, event.teamId);

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
		await assertCanMutateTeamById(ctx, event.teamId);

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

// One-time backfill: populate reviewerName for existing assignmentHistory records
export const backfillAssignmentHistoryNames = mutation({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const reviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.collect();
		const byId = new Map<Id<"reviewers">, Doc<"reviewers">>();
		for (const r of reviewers) byId.set(r._id, r);

		const history = await ctx.db
			.query("assignmentHistory")
			.withIndex("by_team_timestamp", (q) => q.eq("teamId", team._id))
			.collect();

		let patched = 0;
		for (const item of history) {
			const updates: { reviewerName?: string; actionByName?: string } = {};
			if (!item.reviewerName) {
				const reviewer = byId.get(item.reviewerId);
				if (reviewer) {
					updates.reviewerName = reviewer.name;
				}
			}
			if (!item.actionByName && item.actionByReviewerId) {
				const actor = byId.get(item.actionByReviewerId);
				if (actor) {
					updates.actionByName = actor.name;
				}
			}
			if (Object.keys(updates).length > 0) {
				await ctx.db.patch(item._id, updates);
				patched++;
			}
		}

		// Also backfill the assignment feed
		const feed = await ctx.db
			.query("assignmentFeed")
			.withIndex("by_team", (q) => q.eq("teamId", team._id))
			.first();
		if (feed) {
			const updatedItems = feed.items.map((item) => {
				const reviewer = byId.get(item.reviewerId as Id<"reviewers">);
				const actor = item.actionByReviewerId
					? byId.get(item.actionByReviewerId)
					: undefined;
				return {
					...item,
					reviewerName: item.reviewerName ?? reviewer?.name,
					actionByName: item.actionByName ?? actor?.name,
				};
			});
			await ctx.db.patch(feed._id, { items: updatedItems });
		}

		return { success: true, patched };
	},
});
