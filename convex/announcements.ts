import { v } from "convex/values";
import {
	isAnnouncementVisible,
	sortAnnouncements,
} from "../lib/announcementVisibility";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { assertAppAdmin, isAdminEmail, requireIdentity } from "./authz";

const MAX_BODY_LENGTH = 400;
const MAX_KEY_LENGTH = 60;
const KEY_REGEX = /^[a-z0-9][a-z0-9-]*$/;

const audienceValidator = v.union(
	v.literal("everyone"),
	v.literal("admins"),
	v.literal("teams"),
);
const statusValidator = v.union(
	v.literal("draft"),
	v.literal("published"),
	v.literal("archived"),
);
const variantValidator = v.union(
	v.literal("default"),
	v.literal("destructive"),
);

function normalizeKey(key: string): string {
	const normalized = key.trim().toLowerCase();
	if (!KEY_REGEX.test(normalized) || normalized.length > MAX_KEY_LENGTH) {
		throw new Error(
			"Key must be lowercase letters, digits and dashes, starting with a letter or digit",
		);
	}
	return normalized;
}

function normalizeBody(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return trimmed.slice(0, MAX_BODY_LENGTH);
}

/** Only http(s), so a stored link can never become a javascript: payload. */
function normalizeUrl(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new Error("Link must be a full URL, for example https://example.com");
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		throw new Error("Link must use http or https");
	}
	return parsed.toString();
}

async function collectDismissedKeys(
	ctx: QueryCtx,
	userTokenIdentifier: string,
): Promise<Set<string>> {
	const rows = await ctx.db
		.query("announcementDismissals")
		.withIndex("by_user", (q) =>
			q.eq("userTokenIdentifier", userTokenIdentifier),
		)
		.collect();
	return new Set(rows.map((row) => row.announcementKey));
}

/**
 * Everything the banner needs, in one query.
 *
 * The dismissal join, the audience filter and the events check all happen
 * server-side, so the client makes a single request instead of the two it used
 * to make against a hardcoded array.
 */
export const listForMe = query({
	args: { teamSlug: v.optional(v.string()) },
	handler: async (ctx, { teamSlug }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return [];

		const published = await ctx.db
			.query("announcements")
			.withIndex("by_status_order", (q) => q.eq("status", "published"))
			.collect();
		if (published.length === 0) return [];

		const dismissedKeys = await collectDismissedKeys(
			ctx,
			identity.tokenIdentifier,
		);
		const isAdmin = await isAdminEmail(ctx, identity.email);

		const team = teamSlug
			? await ctx.db
					.query("teams")
					.withIndex("by_slug", (q) => q.eq("slug", teamSlug))
					.first()
			: null;

		// Only pay for the events lookup when an announcement actually asks.
		const needsEventsCheck = published.some(
			(row) => row.requiresTeamEvents === true,
		);
		let teamHasEvents = false;
		if (needsEventsCheck && team) {
			const event = await ctx.db
				.query("events")
				.withIndex("by_team", (q) => q.eq("teamId", team._id))
				.first();
			teamHasEvents = event !== null;
		}

		const viewer = {
			now: Date.now(),
			isAdmin,
			teamId: team?._id ?? null,
			teamHasEvents,
			dismissedKeys,
		};

		return sortAnnouncements(
			published.filter((row) =>
				isAnnouncementVisible(
					{
						key: row.key,
						status: row.status,
						audience: row.audience,
						teamIds: row.teamIds,
						requiresTeamEvents: row.requiresTeamEvents,
						startsAt: row.startsAt,
						endsAt: row.endsAt,
						order: row.order,
					},
					viewer,
				),
			),
		).map((row) => ({
			_id: row._id,
			key: row.key,
			variant: row.variant,
			bodyEs: row.bodyEs,
			bodyEn: row.bodyEn,
			translationKey: row.translationKey,
			linkUrl: row.linkUrl,
			linkLabelEs: row.linkLabelEs,
			linkLabelEn: row.linkLabelEn,
			dismissible: row.dismissible,
		}));
	},
});

export const dismiss = mutation({
	args: { key: v.string() },
	handler: async (ctx, { key }) => {
		const identity = await requireIdentity(ctx);
		const existing = await ctx.db
			.query("announcementDismissals")
			.withIndex("by_user_key", (q) =>
				q
					.eq("userTokenIdentifier", identity.tokenIdentifier)
					.eq("announcementKey", key),
			)
			.first();
		if (existing) return { dismissed: true };

		await ctx.db.insert("announcementDismissals", {
			userTokenIdentifier: identity.tokenIdentifier,
			announcementKey: key,
			createdAt: Date.now(),
		});
		return { dismissed: true };
	},
});

/**
 * Carries over dismissals from the localStorage era.
 *
 * Without this every existing user would see four already-dismissed banners
 * reappear the day this ships.
 */
export const importLegacyDismissals = mutation({
	args: { keys: v.array(v.string()) },
	handler: async (ctx, { keys }) => {
		const identity = await requireIdentity(ctx);
		let imported = 0;

		for (const rawKey of keys.slice(0, 50)) {
			const key = rawKey.trim();
			if (!key) continue;
			const existing = await ctx.db
				.query("announcementDismissals")
				.withIndex("by_user_key", (q) =>
					q
						.eq("userTokenIdentifier", identity.tokenIdentifier)
						.eq("announcementKey", key),
				)
				.first();
			if (existing) continue;
			await ctx.db.insert("announcementDismissals", {
				userTokenIdentifier: identity.tokenIdentifier,
				announcementKey: key,
				createdAt: Date.now(),
			});
			imported += 1;
		}

		return { imported };
	},
});

// ---------------------------------------------------------------------------
// Admin console
// ---------------------------------------------------------------------------

export const listAll = query({
	args: {},
	handler: async (ctx) => {
		await assertAppAdmin(ctx);
		const rows = await ctx.db.query("announcements").collect();
		const teams = await ctx.db.query("teams").collect();
		return {
			teams: teams.map((team) => ({
				_id: team._id,
				name: team.name,
				slug: team.slug,
			})),
			announcements: sortAnnouncements(rows).map((row) => ({
				...row,
				/** Built-ins render from messages/*.json and have no editable body. */
				isBuiltIn: row.translationKey !== undefined,
			})),
		};
	},
});

const upsertArgs = {
	key: v.string(),
	status: statusValidator,
	variant: variantValidator,
	bodyEs: v.optional(v.string()),
	bodyEn: v.optional(v.string()),
	linkUrl: v.optional(v.string()),
	linkLabelEs: v.optional(v.string()),
	linkLabelEn: v.optional(v.string()),
	audience: audienceValidator,
	teamIds: v.optional(v.array(v.id("teams"))),
	requiresTeamEvents: v.optional(v.boolean()),
	startsAt: v.optional(v.number()),
	endsAt: v.optional(v.number()),
	dismissible: v.optional(v.boolean()),
	order: v.optional(v.number()),
};

function validateWindow(startsAt?: number, endsAt?: number) {
	if (startsAt !== undefined && endsAt !== undefined && endsAt <= startsAt) {
		throw new Error("The end of the window must come after its start");
	}
}

export const createAnnouncement = mutation({
	args: upsertArgs,
	handler: async (ctx, args) => {
		const { normalizedEmail } = await assertAppAdmin(ctx);
		const key = normalizeKey(args.key);

		const existing = await ctx.db
			.query("announcements")
			.withIndex("by_key", (q) => q.eq("key", key))
			.first();
		if (existing)
			throw new Error("An announcement with that key already exists");

		const bodyEs = normalizeBody(args.bodyEs);
		const bodyEn = normalizeBody(args.bodyEn);
		if (!bodyEs && !bodyEn) {
			throw new Error("Write the announcement in at least one language");
		}
		if (args.audience === "teams" && (args.teamIds ?? []).length === 0) {
			throw new Error("Pick at least one team, or change the audience");
		}
		validateWindow(args.startsAt, args.endsAt);

		const now = Date.now();
		return ctx.db.insert("announcements", {
			key,
			status: args.status,
			variant: args.variant,
			bodyEs,
			bodyEn,
			linkUrl: normalizeUrl(args.linkUrl),
			linkLabelEs: normalizeBody(args.linkLabelEs),
			linkLabelEn: normalizeBody(args.linkLabelEn),
			audience: args.audience,
			teamIds: args.audience === "teams" ? args.teamIds : undefined,
			requiresTeamEvents: args.requiresTeamEvents,
			startsAt: args.startsAt,
			endsAt: args.endsAt,
			dismissible: args.dismissible !== false,
			order: args.order,
			createdAt: now,
			updatedAt: now,
			createdByEmail: normalizedEmail ?? undefined,
		});
	},
});

export const updateAnnouncement = mutation({
	args: { id: v.id("announcements"), ...upsertArgs },
	handler: async (ctx, { id, ...args }) => {
		await assertAppAdmin(ctx);
		const existing = await ctx.db.get(id);
		if (!existing) throw new Error("Announcement not found");

		const key = normalizeKey(args.key);
		if (key !== existing.key) {
			const clash = await ctx.db
				.query("announcements")
				.withIndex("by_key", (q) => q.eq("key", key))
				.first();
			if (clash)
				throw new Error("An announcement with that key already exists");
		}

		const bodyEs = normalizeBody(args.bodyEs);
		const bodyEn = normalizeBody(args.bodyEn);
		// Built-ins render from messages/*.json, so an empty body is expected.
		if (!existing.translationKey && !bodyEs && !bodyEn) {
			throw new Error("Write the announcement in at least one language");
		}
		if (args.audience === "teams" && (args.teamIds ?? []).length === 0) {
			throw new Error("Pick at least one team, or change the audience");
		}
		validateWindow(args.startsAt, args.endsAt);

		await ctx.db.patch(id, {
			key,
			status: args.status,
			variant: args.variant,
			bodyEs,
			bodyEn,
			linkUrl: normalizeUrl(args.linkUrl),
			linkLabelEs: normalizeBody(args.linkLabelEs),
			linkLabelEn: normalizeBody(args.linkLabelEn),
			audience: args.audience,
			teamIds: args.audience === "teams" ? args.teamIds : undefined,
			requiresTeamEvents: args.requiresTeamEvents,
			startsAt: args.startsAt,
			endsAt: args.endsAt,
			dismissible: args.dismissible !== false,
			order: args.order,
			updatedAt: Date.now(),
		});
		return { updated: true };
	},
});

export const deleteAnnouncement = mutation({
	args: { id: v.id("announcements") },
	handler: async (ctx, { id }) => {
		await assertAppAdmin(ctx);
		const existing = await ctx.db.get(id);
		if (!existing) return { deleted: false };
		await ctx.db.delete(id);
		return { deleted: true };
	},
});

/**
 * Clears every dismissal for one announcement, so republishing it actually
 * reaches the people who dismissed the previous run.
 */
export const resetDismissals = mutation({
	args: { key: v.string() },
	handler: async (ctx, { key }) => {
		await assertAppAdmin(ctx);
		const rows = await ctx.db
			.query("announcementDismissals")
			.filter((q) => q.eq(q.field("announcementKey"), key))
			.collect();
		for (const row of rows) {
			await ctx.db.delete(row._id);
		}
		return { cleared: rows.length };
	},
});

/**
 * Recreates the four banners that used to live in AnnouncementBanner.tsx as
 * rows pointing at their existing messages/*.json keys, so no copy migrates.
 */
export const seedBuiltInAnnouncements = mutation({
	args: { dryRun: v.optional(v.boolean()) },
	handler: async (ctx, { dryRun = true }) => {
		const { normalizedEmail } = await assertAppAdmin(ctx);

		const builtIns: Array<{
			key: string;
			translationKey: string;
			linkUrl?: string;
			requiresTeamEvents?: boolean;
			order: number;
		}> = [
			{
				key: "coord-la-lista-v1",
				translationKey: "announcements.coordChannel",
				linkUrl: "https://chat.google.com/room/AAQA237JK9g?cls=7",
				order: 1,
			},
			{
				key: "create-event-navbar-v1",
				translationKey: "announcements.createEventMoved",
				requiresTeamEvents: true,
				order: 2,
			},
			{
				key: "reviewers-panel-v1",
				translationKey: "announcements.reviewersPanelMoved",
				order: 3,
			},
			{
				key: "mcp-setup-wizard-v1",
				translationKey: "announcements.mcpSetupWizard",
				order: 4,
			},
		];

		const created: string[] = [];
		const skipped: string[] = [];
		const now = Date.now();

		for (const builtIn of builtIns) {
			const existing = await ctx.db
				.query("announcements")
				.withIndex("by_key", (q) => q.eq("key", builtIn.key))
				.first();
			if (existing) {
				skipped.push(builtIn.key);
				continue;
			}
			created.push(builtIn.key);
			if (!dryRun) {
				await ctx.db.insert("announcements", {
					key: builtIn.key,
					status: "published",
					variant: "default",
					translationKey: builtIn.translationKey,
					linkUrl: builtIn.linkUrl,
					audience: "everyone",
					requiresTeamEvents: builtIn.requiresTeamEvents,
					dismissible: true,
					order: builtIn.order,
					createdAt: now,
					updatedAt: now,
					createdByEmail: normalizedEmail ?? undefined,
				});
			}
		}

		return { dryRun, created, skipped };
	},
});
