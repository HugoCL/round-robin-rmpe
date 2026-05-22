import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import {
	assertAgentTokenCanAccessTeamId,
	assertCanMutateTeamById,
	isAdminEmail,
	normalizeEmail,
	requireIdentity,
} from "./authz";

const MAX_LIST_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 100;
const FEATURE_FLAG_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

type FeatureFlagStatus = "active" | "removed";

const listStatusFilterValidator = v.union(
	v.literal("active"),
	v.literal("removed"),
	v.literal("all"),
);

const sortValidator = v.union(
	v.literal("oldest"),
	v.literal("newest"),
	v.literal("key"),
);

async function getTeamBySlugOrThrow(
	ctx: QueryCtx | MutationCtx,
	teamSlug: string,
) {
	const team = await ctx.db
		.query("teams")
		.withIndex("by_slug", (q) => q.eq("slug", teamSlug))
		.first();
	if (!team) {
		throw new Error("Team not found");
	}
	return team;
}

function clampLimit(limit: number | undefined): number {
	if (!limit) return DEFAULT_LIST_LIMIT;
	return Math.max(1, Math.min(limit, MAX_LIST_LIMIT));
}

function normalizeText(
	value: string,
	{
		min,
		max,
		field,
	}: {
		min: number;
		max: number;
		field: string;
	},
): string {
	const normalized = value.trim();
	if (normalized.length < min || normalized.length > max) {
		throw new Error(`${field} must be between ${min} and ${max} characters`);
	}
	return normalized;
}

function normalizeFeatureFlagKey(rawKey: string): string {
	const normalized = rawKey
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "");

	if (normalized.length < 2 || normalized.length > 80) {
		throw new Error("Key must be between 2 and 80 characters");
	}
	if (!FEATURE_FLAG_KEY_REGEX.test(normalized)) {
		throw new Error(
			"Key must start with a letter and use only lowercase letters, numbers, and underscores",
		);
	}
	return normalized;
}

function resolveIdentityName(identity: {
	name?: string | null;
	email?: string | null;
}): string {
	const preferred = identity.name?.trim() || identity.email?.trim();
	return preferred || "Anonymous";
}

function resolveAgentAuthorName(token: Doc<"agentTokens">): string {
	const preferred = token.email?.trim();
	return preferred || "Agent";
}

async function getAgentTokenOrThrow(
	ctx: QueryCtx | MutationCtx,
	agentTokenHash: string,
): Promise<Doc<"agentTokens">> {
	const token = await ctx.db
		.query("agentTokens")
		.withIndex("by_token_hash", (q) => q.eq("tokenHash", agentTokenHash))
		.first();
	if (!token || token.revokedAt) {
		throw new Error("Unauthorized");
	}
	return token;
}

async function assertAgentCanAccessTeamSlug(
	ctx: QueryCtx | MutationCtx,
	agentTokenHash: string,
	teamSlug: string,
) {
	const team = await getTeamBySlugOrThrow(ctx, teamSlug);
	await assertAgentTokenCanAccessTeamId(ctx, agentTokenHash, team._id);
	return team;
}

async function buildFeatureFlagsList(
	ctx: QueryCtx,
	{
		teamId,
		status,
		sort,
		limit,
		canManage,
	}: {
		teamId: Id<"teams">;
		status: "active" | "removed" | "all";
		sort: "oldest" | "newest" | "key";
		limit: number;
		canManage: boolean;
	},
) {
	const [activeFlags, flags] = await Promise.all([
		listFlagsForTeamStatus(ctx, {
			teamId,
			status: "active",
			limit,
		}),
		status === "all"
			? Promise.all([
					listFlagsForTeamStatus(ctx, {
						teamId,
						status: "active",
						limit,
					}),
					listFlagsForTeamStatus(ctx, {
						teamId,
						status: "removed",
						limit,
					}),
				]).then(([active, removed]) => [...active, ...removed])
			: listFlagsForTeamStatus(ctx, {
					teamId,
					status,
					limit,
				}),
	]);

	const sorted = sortFeatureFlags(flags, sort);

	return {
		flags: sorted,
		canManage,
		summary: {
			activeCount: activeFlags.length,
			returnedCount: sorted.length,
		},
	};
}

async function resolveCanManageTeam(
	ctx: QueryCtx,
	teamId: Id<"teams">,
	identity: { email?: string | null },
): Promise<boolean> {
	if (isAdminEmail(identity.email)) {
		return true;
	}
	const normalizedEmail = normalizeEmail(identity.email);
	if (!normalizedEmail) {
		return false;
	}
	const match = await ctx.db
		.query("reviewers")
		.withIndex("by_team_email", (q) =>
			q.eq("teamId", teamId).eq("email", normalizedEmail),
		)
		.first();
	return match !== null;
}

async function listFlagsForTeamStatus(
	ctx: QueryCtx,
	{
		teamId,
		status,
		limit,
	}: {
		teamId: Id<"teams">;
		status: FeatureFlagStatus;
		limit: number;
	},
): Promise<Doc<"featureFlags">[]> {
	return ctx.db
		.query("featureFlags")
		.withIndex("by_team_status_created_at", (q) =>
			q.eq("teamId", teamId).eq("status", status),
		)
		.order("asc")
		.take(limit);
}

function sortFeatureFlags(
	flags: Doc<"featureFlags">[],
	sort: "oldest" | "newest" | "key",
): Doc<"featureFlags">[] {
	if (sort === "key") {
		return [...flags].sort((a, b) => a.key.localeCompare(b.key));
	}
	if (sort === "newest") {
		return [...flags].sort((a, b) => b.createdAt - a.createdAt);
	}
	return [...flags].sort((a, b) => a.createdAt - b.createdAt);
}

export const listFeatureFlagsForTeam = query({
	args: {
		teamSlug: v.string(),
		status: v.optional(listStatusFilterValidator),
		sort: v.optional(sortValidator),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, { teamSlug, status, sort, limit }) => {
		const identity = await requireIdentity(ctx);
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const resolvedLimit = clampLimit(limit);
		const resolvedStatus = status ?? "active";
		const resolvedSort = sort ?? "oldest";

		const canManage = await resolveCanManageTeam(ctx, team._id, identity);

		return buildFeatureFlagsList(ctx, {
			teamId: team._id,
			status: resolvedStatus,
			sort: resolvedSort,
			limit: resolvedLimit,
			canManage,
		});
	},
});

export const listFeatureFlagsForAgent = query({
	args: {
		agentTokenHash: v.string(),
		teamSlug: v.string(),
		status: v.optional(listStatusFilterValidator),
		sort: v.optional(sortValidator),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, { agentTokenHash, teamSlug, status, sort, limit }) => {
		await getAgentTokenOrThrow(ctx, agentTokenHash);
		const team = await assertAgentCanAccessTeamSlug(
			ctx,
			agentTokenHash,
			teamSlug,
		);
		const resolvedLimit = clampLimit(limit);
		const resolvedStatus = status ?? "active";
		const resolvedSort = sort ?? "oldest";

		return buildFeatureFlagsList(ctx, {
			teamId: team._id,
			status: resolvedStatus,
			sort: resolvedSort,
			limit: resolvedLimit,
			canManage: true,
		});
	},
});

export const createFeatureFlag = mutation({
	args: {
		teamSlug: v.string(),
		key: v.string(),
		description: v.optional(v.string()),
	},
	handler: async (ctx, { teamSlug, key, description }) => {
		const team = await getTeamBySlugOrThrow(ctx, teamSlug);
		const { identity } = await assertCanMutateTeamById(ctx, team._id);

		const normalizedKey = normalizeFeatureFlagKey(key);
		const existing = await ctx.db
			.query("featureFlags")
			.withIndex("by_team_key", (q) =>
				q.eq("teamId", team._id).eq("key", normalizedKey),
			)
			.first();
		if (existing) {
			throw new Error(
				"A feature flag with this key already exists for this team",
			);
		}

		const normalizedDescription = description
			? normalizeText(description, {
					min: 1,
					max: 500,
					field: "Description",
				})
			: undefined;

		const now = Date.now();
		const featureFlagId = await ctx.db.insert("featureFlags", {
			teamId: team._id,
			key: normalizedKey,
			description: normalizedDescription,
			status: "active",
			createdAt: now,
			createdBy: {
				authorTokenIdentifier: identity.tokenIdentifier,
				authorName: resolveIdentityName(identity),
				authorEmail: identity.email ?? undefined,
			},
			updatedAt: now,
		});

		return { featureFlagId };
	},
});

export const createFeatureFlagForAgent = mutation({
	args: {
		agentTokenHash: v.string(),
		teamSlug: v.string(),
		key: v.string(),
		description: v.optional(v.string()),
	},
	handler: async (ctx, { agentTokenHash, teamSlug, key, description }) => {
		const token = await getAgentTokenOrThrow(ctx, agentTokenHash);
		const team = await assertAgentCanAccessTeamSlug(
			ctx,
			agentTokenHash,
			teamSlug,
		);

		const normalizedKey = normalizeFeatureFlagKey(key);
		const existing = await ctx.db
			.query("featureFlags")
			.withIndex("by_team_key", (q) =>
				q.eq("teamId", team._id).eq("key", normalizedKey),
			)
			.first();
		if (existing) {
			throw new Error(
				"A feature flag with this key already exists for this team",
			);
		}

		const normalizedDescription = description
			? normalizeText(description, {
					min: 1,
					max: 500,
					field: "Description",
				})
			: undefined;

		const now = Date.now();
		const featureFlagId = await ctx.db.insert("featureFlags", {
			teamId: team._id,
			key: normalizedKey,
			description: normalizedDescription,
			status: "active",
			createdAt: now,
			createdBy: {
				authorTokenIdentifier: token.userTokenIdentifier,
				authorName: resolveAgentAuthorName(token),
				authorEmail: token.email,
			},
			updatedAt: now,
		});

		return { featureFlagId, key: normalizedKey };
	},
});

export const updateFeatureFlag = mutation({
	args: {
		featureFlagId: v.id("featureFlags"),
		description: v.optional(v.string()),
	},
	handler: async (ctx, { featureFlagId, description }) => {
		const flag = await ctx.db.get(featureFlagId);
		if (!flag) {
			throw new Error("Feature flag not found");
		}
		if (flag.status !== "active") {
			throw new Error("Only active feature flags can be updated");
		}

		await assertCanMutateTeamById(ctx, flag.teamId);

		const normalizedDescription = description
			? normalizeText(description, {
					min: 1,
					max: 500,
					field: "Description",
				})
			: undefined;

		await ctx.db.patch(featureFlagId, {
			description: normalizedDescription,
			updatedAt: Date.now(),
		});

		return { featureFlagId };
	},
});

export const removeFeatureFlag = mutation({
	args: {
		featureFlagId: v.id("featureFlags"),
	},
	handler: async (ctx, { featureFlagId }) => {
		const flag = await ctx.db.get(featureFlagId);
		if (!flag) {
			throw new Error("Feature flag not found");
		}
		if (flag.status === "removed") {
			return { featureFlagId };
		}

		await assertCanMutateTeamById(ctx, flag.teamId);

		const now = Date.now();
		await ctx.db.patch(featureFlagId, {
			status: "removed",
			removedAt: now,
			updatedAt: now,
		});

		return { featureFlagId };
	},
});

export const removeFeatureFlagForAgent = mutation({
	args: {
		agentTokenHash: v.string(),
		featureFlagId: v.id("featureFlags"),
	},
	handler: async (ctx, { agentTokenHash, featureFlagId }) => {
		await getAgentTokenOrThrow(ctx, agentTokenHash);

		const flag = await ctx.db.get(featureFlagId);
		if (!flag) {
			throw new Error("Feature flag not found");
		}
		if (flag.status === "removed") {
			return { featureFlagId, key: flag.key };
		}

		await assertAgentTokenCanAccessTeamId(ctx, agentTokenHash, flag.teamId);

		const now = Date.now();
		await ctx.db.patch(featureFlagId, {
			status: "removed",
			removedAt: now,
			updatedAt: now,
		});

		return { featureFlagId, key: flag.key };
	},
});
