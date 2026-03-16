import { v } from "convex/values";
import {
	createAgentTokenValue,
	getAgentTokenPrefix,
	hashAgentToken,
} from "../lib/agent-token";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";

function selectLatestUserPreference(
	rows: Doc<"userPreferences">[],
): Doc<"userPreferences"> | null {
	if (rows.length === 0) return null;
	return [...rows].sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

async function getAccessibleTeamsByEmail(ctx: QueryCtx, email?: string | null) {
	const normalizedEmail = email?.toLowerCase().trim();
	if (!normalizedEmail) return [];

	const reviewers = await ctx.db.query("reviewers").collect();
	const teamIds = [
		...new Set(
			reviewers
				.filter(
					(reviewer) =>
						reviewer.teamId && reviewer.email.toLowerCase() === normalizedEmail,
				)
				.map((reviewer) => reviewer.teamId)
				.filter(Boolean),
		),
	];

	const teams = await Promise.all(
		teamIds.map((teamId) => (teamId ? ctx.db.get(teamId) : null)),
	);

	return teams
		.filter((team): team is NonNullable<typeof team> => team !== null)
		.map((team) => ({
			id: team._id,
			name: team.name,
			slug: team.slug,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export const getMyTeams = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity?.email) return [];
		return getAccessibleTeamsByEmail(ctx, identity.email);
	},
});

export const getMyAgentTokens = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthorized");

		const tokens = await ctx.db
			.query("agentTokens")
			.withIndex("by_user_token_identifier", (q) =>
				q.eq("userTokenIdentifier", identity.tokenIdentifier),
			)
			.collect();

		return tokens
			.map((token) => ({
				id: token._id,
				label: token.label,
				tokenPrefix: token.tokenPrefix,
				createdAt: token.createdAt,
				lastUsedAt: token.lastUsedAt,
				revokedAt: token.revokedAt,
			}))
			.sort((a, b) => b.createdAt - a.createdAt);
	},
});

export const storeAgentToken = internalMutation({
	args: {
		userTokenIdentifier: v.string(),
		email: v.optional(v.string()),
		label: v.string(),
		tokenHash: v.string(),
		tokenPrefix: v.string(),
		createdAt: v.number(),
	},
	handler: async (ctx, args) => {
		return ctx.db.insert("agentTokens", args);
	},
});

export const createMyAgentToken = action({
	args: {
		label: v.optional(v.string()),
	},
	handler: async (
		ctx,
		{ label },
	): Promise<{
		id: Id<"agentTokens">;
		label: string;
		tokenPrefix: string;
		createdAt: number;
		rawToken: string;
	}> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthorized");

		const rawToken = createAgentTokenValue();
		const tokenHash = await hashAgentToken(rawToken);
		const tokenPrefix = getAgentTokenPrefix(rawToken);
		const createdAt = Date.now();
		const normalizedLabel = label?.trim() || "Personal agent token";

		const id = await ctx.runMutation(internal.agent.storeAgentToken, {
			userTokenIdentifier: identity.tokenIdentifier,
			email: identity.email?.toLowerCase().trim() || undefined,
			label: normalizedLabel,
			tokenHash,
			tokenPrefix,
			createdAt,
		});

		return {
			id,
			label: normalizedLabel,
			tokenPrefix,
			createdAt,
			rawToken,
		};
	},
});

export const revokeMyAgentToken = mutation({
	args: {
		tokenId: v.id("agentTokens"),
	},
	handler: async (ctx, { tokenId }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthorized");

		const token = await ctx.db.get(tokenId);
		if (!token) throw new Error("Token not found");
		if (token.userTokenIdentifier !== identity.tokenIdentifier) {
			throw new Error("Forbidden");
		}

		await ctx.db.patch(tokenId, {
			revokedAt: Date.now(),
		});

		return { success: true };
	},
});

export const authenticateAgentToken = query({
	args: {
		tokenHash: v.string(),
	},
	handler: async (ctx, { tokenHash }) => {
		const token = await ctx.db
			.query("agentTokens")
			.withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
			.first();

		if (!token || token.revokedAt) {
			return null;
		}

		const preferenceRows = await ctx.db
			.query("userPreferences")
			.withIndex("by_user_token_identifier", (q) =>
				q.eq("userTokenIdentifier", token.userTokenIdentifier),
			)
			.collect();
		const preferences = selectLatestUserPreference(preferenceRows);
		const teams = await getAccessibleTeamsByEmail(ctx, token.email);

		return {
			tokenId: token._id,
			userTokenIdentifier: token.userTokenIdentifier,
			email: token.email,
			defaultAgentTeamSlug: preferences?.defaultAgentTeamSlug,
			teams,
		};
	},
});

export const markAgentTokenUsed = mutation({
	args: {
		tokenId: v.id("agentTokens"),
	},
	handler: async (ctx, { tokenId }) => {
		const token = await ctx.db.get(tokenId);
		if (!token || token.revokedAt) {
			return { success: false };
		}

		await ctx.db.patch(tokenId, {
			lastUsedAt: Date.now(),
		});

		return { success: true };
	},
});

export const getMyAgentSetup = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthorized");

		const [teams, preferences] = await Promise.all([
			getAccessibleTeamsByEmail(ctx, identity.email),
			ctx.db
				.query("userPreferences")
				.withIndex("by_user_token_identifier", (q) =>
					q.eq("userTokenIdentifier", identity.tokenIdentifier),
				)
				.collect(),
		]);
		const latestPreferences = selectLatestUserPreference(preferences);
		const tokens = await ctx.db
			.query("agentTokens")
			.withIndex("by_user_token_identifier", (q) =>
				q.eq("userTokenIdentifier", identity.tokenIdentifier),
			)
			.collect();

		return {
			email: identity.email?.toLowerCase().trim() || "",
			teams,
			defaultAgentTeamSlug: latestPreferences?.defaultAgentTeamSlug,
			tokens: tokens
				.map((token) => ({
					id: token._id,
					label: token.label,
					tokenPrefix: token.tokenPrefix,
					createdAt: token.createdAt,
					lastUsedAt: token.lastUsedAt,
					revokedAt: token.revokedAt,
				}))
				.sort((a, b) => b.createdAt - a.createdAt),
		};
	},
});
