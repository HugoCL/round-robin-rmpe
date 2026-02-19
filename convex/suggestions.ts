import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";

const ADMIN_EMAIL_REGEX = /^.+@buk\.[a-zA-Z0-9-]+$/;
const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;

const suggestionStatusValidator = v.union(
	v.literal("open"),
	v.literal("planned"),
	v.literal("completed"),
);

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Unauthorized");
	}
	return identity;
}

function isAdmin(email: string | undefined | null): boolean {
	if (!email) return false;
	return ADMIN_EMAIL_REGEX.test(email);
}

function assertAdmin(email: string | undefined | null) {
	if (!isAdmin(email)) {
		throw new Error("Unauthorized");
	}
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

function clampLimit(limit: number | undefined): number {
	if (!limit) return DEFAULT_LIST_LIMIT;
	return Math.max(1, Math.min(limit, MAX_LIST_LIMIT));
}

function resolveIdentityName(identity: {
	name?: string | null;
	email?: string | null;
}): string {
	const preferred = identity.name?.trim() || identity.email?.trim();
	return preferred || "Anonymous";
}

export const listSuggestions = query({
	args: {
		status: suggestionStatusValidator,
		sort: v.union(v.literal("top"), v.literal("new")),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, { status, sort, limit }) => {
		const identity = await requireIdentity(ctx);
		const resolvedLimit = clampLimit(limit);

		const [suggestions, myVotes] = await Promise.all([
			sort === "top"
				? ctx.db
						.query("suggestions")
						.withIndex("by_status_upvotes", (q) => q.eq("status", status))
						.order("desc")
						.take(resolvedLimit)
				: ctx.db
						.query("suggestions")
						.withIndex("by_status_created_at", (q) => q.eq("status", status))
						.order("desc")
						.take(resolvedLimit),
			ctx.db
				.query("suggestionVotes")
				.withIndex("by_user", (q) =>
					q.eq("userTokenIdentifier", identity.tokenIdentifier),
				)
				.collect(),
		]);

		const votedSuggestionIds = new Set<Id<"suggestions">>(
			myVotes.map((vote) => vote.suggestionId),
		);
		const canModerate = isAdmin(identity.email);

		return suggestions.map((suggestion) => ({
			...suggestion,
			viewerHasUpvoted: votedSuggestionIds.has(suggestion._id),
			canModerate,
		}));
	},
});

export const getSuggestionDetail = query({
	args: {
		suggestionId: v.id("suggestions"),
	},
	handler: async (ctx, { suggestionId }) => {
		const identity = await requireIdentity(ctx);

		const [suggestion, comments, myVote] = await Promise.all([
			ctx.db.get(suggestionId),
			ctx.db
				.query("suggestionComments")
				.withIndex("by_suggestion_created_at", (q) =>
					q.eq("suggestionId", suggestionId),
				)
				.order("asc")
				.collect(),
			ctx.db
				.query("suggestionVotes")
				.withIndex("by_suggestion_user", (q) =>
					q
						.eq("suggestionId", suggestionId)
						.eq("userTokenIdentifier", identity.tokenIdentifier),
				)
				.first(),
		]);

		if (!suggestion) {
			return null;
		}

		const viewerHasUpvoted = Boolean(myVote);
		return {
			suggestion: {
				...suggestion,
				viewerHasUpvoted,
			},
			comments,
			viewerHasUpvoted,
			canModerate: isAdmin(identity.email),
		};
	},
});

export const createSuggestion = mutation({
	args: {
		title: v.string(),
		description: v.string(),
	},
	handler: async (ctx, { title, description }) => {
		const identity = await requireIdentity(ctx);
		const normalizedTitle = normalizeText(title, {
			min: 3,
			max: 120,
			field: "Title",
		});
		const normalizedDescription = normalizeText(description, {
			min: 3,
			max: 2000,
			field: "Description",
		});

		const now = Date.now();
		const suggestionId = await ctx.db.insert("suggestions", {
			title: normalizedTitle,
			description: normalizedDescription,
			status: "open",
			authorTokenIdentifier: identity.tokenIdentifier,
			authorName: resolveIdentityName(identity),
			authorEmail: identity.email?.trim() || undefined,
			upvoteCount: 0,
			commentCount: 0,
			createdAt: now,
			updatedAt: now,
		});

		return { suggestionId };
	},
});

export const toggleSuggestionVote = mutation({
	args: {
		suggestionId: v.id("suggestions"),
	},
	handler: async (ctx, { suggestionId }) => {
		const identity = await requireIdentity(ctx);
		const suggestion = await ctx.db.get(suggestionId);
		if (!suggestion) {
			throw new Error("Suggestion not found");
		}

		const existingVote = await ctx.db
			.query("suggestionVotes")
			.withIndex("by_suggestion_user", (q) =>
				q
					.eq("suggestionId", suggestionId)
					.eq("userTokenIdentifier", identity.tokenIdentifier),
			)
			.first();

		const now = Date.now();
		if (existingVote) {
			await ctx.db.delete(existingVote._id);
			const nextCount = Math.max(0, suggestion.upvoteCount - 1);
			await ctx.db.patch(suggestionId, {
				upvoteCount: nextCount,
				updatedAt: now,
			});
			return {
				upvoted: false,
				upvoteCount: nextCount,
			};
		}

		await ctx.db.insert("suggestionVotes", {
			suggestionId,
			userTokenIdentifier: identity.tokenIdentifier,
			createdAt: now,
		});
		const nextCount = suggestion.upvoteCount + 1;
		await ctx.db.patch(suggestionId, {
			upvoteCount: nextCount,
			updatedAt: now,
		});
		return {
			upvoted: true,
			upvoteCount: nextCount,
		};
	},
});

export const addSuggestionComment = mutation({
	args: {
		suggestionId: v.id("suggestions"),
		body: v.string(),
	},
	handler: async (ctx, { suggestionId, body }) => {
		const identity = await requireIdentity(ctx);
		const suggestion = await ctx.db.get(suggestionId);
		if (!suggestion) {
			throw new Error("Suggestion not found");
		}

		const normalizedBody = normalizeText(body, {
			min: 1,
			max: 1000,
			field: "Comment",
		});
		const now = Date.now();
		const commentId = await ctx.db.insert("suggestionComments", {
			suggestionId,
			authorTokenIdentifier: identity.tokenIdentifier,
			authorName: resolveIdentityName(identity),
			authorEmail: identity.email?.trim() || undefined,
			body: normalizedBody,
			createdAt: now,
		});

		await ctx.db.patch(suggestionId, {
			commentCount: suggestion.commentCount + 1,
			updatedAt: now,
		});

		return { commentId };
	},
});

export const updateSuggestionStatus = mutation({
	args: {
		suggestionId: v.id("suggestions"),
		status: suggestionStatusValidator,
	},
	handler: async (ctx, { suggestionId, status }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const suggestion = await ctx.db.get(suggestionId);
		if (!suggestion) {
			throw new Error("Suggestion not found");
		}

		await ctx.db.patch(suggestionId, {
			status,
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

export const deleteSuggestion = mutation({
	args: {
		suggestionId: v.id("suggestions"),
	},
	handler: async (ctx, { suggestionId }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const suggestion = await ctx.db.get(suggestionId);
		if (!suggestion) {
			throw new Error("Suggestion not found");
		}

		const [votes, comments] = await Promise.all([
			ctx.db
				.query("suggestionVotes")
				.withIndex("by_suggestion", (q) => q.eq("suggestionId", suggestionId))
				.collect(),
			ctx.db
				.query("suggestionComments")
				.withIndex("by_suggestion_created_at", (q) =>
					q.eq("suggestionId", suggestionId),
				)
				.collect(),
		]);

		for (const vote of votes) {
			await ctx.db.delete(vote._id);
		}
		for (const comment of comments) {
			await ctx.db.delete(comment._id);
		}
		await ctx.db.delete(suggestionId);

		return { success: true };
	},
});

export const deleteSuggestionComment = mutation({
	args: {
		commentId: v.id("suggestionComments"),
	},
	handler: async (ctx, { commentId }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const comment = await ctx.db.get(commentId);
		if (!comment) {
			throw new Error("Comment not found");
		}

		await ctx.db.delete(commentId);

		const suggestion = await ctx.db.get(comment.suggestionId);
		if (suggestion) {
			await ctx.db.patch(suggestion._id, {
				commentCount: Math.max(0, suggestion.commentCount - 1),
				updatedAt: Date.now(),
			});
		}

		return { success: true };
	},
});
