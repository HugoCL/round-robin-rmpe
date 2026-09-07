import { v } from "convex/values";
import { isAppFeatureKey } from "../lib/appFeatures";
import {
	clampInteger,
	DEFAULT_OPS,
	isValidEmailPattern,
	MAX_EMAIL_PATTERN_LENGTH,
	normalizeDomains,
	OPS_BOUNDS,
	parseEmailAccessEnv,
	type ResolvedAppSettings,
	resolveAppSettings,
} from "../lib/appSettings";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { type AuthCtx, assertAppAdmin } from "./authz";

/**
 * The app-wide settings singleton.
 *
 * The read path is a single indexed document lookup, which matters because the
 * authorization helpers touch it on nearly every mutation.
 */
export async function getAppSettingsDoc(
	ctx: AuthCtx,
): Promise<Doc<"appSettings"> | null> {
	return ctx.db
		.query("appSettings")
		.withIndex("by_key", (q) => q.eq("key", "singleton"))
		.first();
}

/**
 * The environment's opening bid on who may sign in.
 *
 * Read once at module load, like ADMIN_ALLOWLIST_EMAILS, and used ONLY while
 * no policy has been saved in the console. It exists so an instance can be
 * deployed closed: the code default is "open", and on an instance upgrading
 * from a hardcoded rule that default would widen access the moment this code
 * ships. Setting EMAIL_ACCESS_ALLOWED_PATTERN (or _DOMAINS) removes that
 * window entirely, with no seeding step and no ordering constraint.
 */
const EMAIL_ACCESS_ENV = parseEmailAccessEnv({
	pattern: process.env.EMAIL_ACCESS_ALLOWED_PATTERN,
	domains: process.env.EMAIL_ACCESS_ALLOWED_DOMAINS,
	allowClerkTestEmails: process.env.EMAIL_ACCESS_ALLOW_CLERK_TEST_EMAILS,
});

/** Defaults reproduce the pre-console hardcoded behaviour when no row exists. */
export async function getResolvedAppSettings(
	ctx: AuthCtx,
): Promise<ResolvedAppSettings> {
	return resolveAppSettings(await getAppSettingsDoc(ctx), {
		emailAccessFallback: EMAIL_ACCESS_ENV.policy,
	});
}

async function patchSettings(
	ctx: MutationCtx,
	patch: Partial<
		Pick<Doc<"appSettings">, "emailAccess" | "featureToggles" | "ops">
	>,
	updatedByEmail: string | null,
) {
	const existing = await getAppSettingsDoc(ctx);
	const now = Date.now();
	if (existing) {
		await ctx.db.patch(existing._id, {
			...patch,
			updatedAt: now,
			updatedByEmail: updatedByEmail ?? undefined,
		});
		return existing._id;
	}
	return ctx.db.insert("appSettings", {
		key: "singleton",
		...patch,
		updatedAt: now,
		updatedByEmail: updatedByEmail ?? undefined,
	});
}

export const getSettings = query({
	args: {},
	handler: async (ctx) => {
		await assertAppAdmin(ctx);
		const doc = await getAppSettingsDoc(ctx);
		const source = doc?.emailAccess
			? ("database" as const)
			: EMAIL_ACCESS_ENV.policy
				? ("environment" as const)
				: ("default" as const);
		return {
			resolved: resolveAppSettings(doc, {
				emailAccessFallback: EMAIL_ACCESS_ENV.policy,
			}),
			/** False only when nothing decided the policy, i.e. it is open by default. */
			isConfigured: source !== "default",
			/** Where the enforced policy comes from. Saving one moves it to "database". */
			emailAccessSource: source,
			/** Set when an environment policy was requested but could not be parsed. */
			emailAccessEnvError: EMAIL_ACCESS_ENV.error,
			updatedAt: doc?.updatedAt ?? null,
			updatedByEmail: doc?.updatedByEmail ?? null,
		};
	},
});

export const updateEmailAccess = mutation({
	args: {
		mode: v.union(
			v.literal("open"),
			v.literal("domains"),
			v.literal("pattern"),
		),
		allowedDomains: v.optional(v.array(v.string())),
		allowedEmailPattern: v.optional(v.string()),
		allowClerkTestEmails: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const { normalizedEmail } = await assertAppAdmin(ctx);

		// resolveEmailAccess() silently downgrades an unusable policy to "open"
		// so a bad stored row can never lock anyone out. On the write path we
		// reject instead, so the admin finds out immediately.
		if (args.mode === "domains") {
			const allowedDomains = normalizeDomains(args.allowedDomains);
			if (allowedDomains.length === 0) {
				throw new Error(
					"Domain mode needs at least one valid domain, for example acme.com",
				);
			}
			await patchSettings(
				ctx,
				{
					emailAccess: {
						mode: "domains",
						allowedDomains,
						allowClerkTestEmails: args.allowClerkTestEmails === true,
					},
				},
				normalizedEmail,
			);
			return { mode: "domains" as const, allowedDomains };
		}

		if (args.mode === "pattern") {
			const pattern = args.allowedEmailPattern?.trim() ?? "";
			if (!isValidEmailPattern(pattern)) {
				throw new Error(
					`Pattern must be a valid regular expression of at most ${MAX_EMAIL_PATTERN_LENGTH} characters`,
				);
			}
			await patchSettings(
				ctx,
				{
					emailAccess: {
						mode: "pattern",
						allowedEmailPattern: pattern,
						allowClerkTestEmails: args.allowClerkTestEmails === true,
					},
				},
				normalizedEmail,
			);
			return { mode: "pattern" as const, allowedEmailPattern: pattern };
		}

		await patchSettings(
			ctx,
			{
				emailAccess: {
					mode: "open",
					allowClerkTestEmails: args.allowClerkTestEmails === true,
				},
			},
			normalizedEmail,
		);
		return { mode: "open" as const };
	},
});

/**
 * Writes an explicit policy without going through the console UI.
 *
 * Note this still requires a signed-in admin, so it cannot be run from the
 * Convex CLI. To deploy an instance closed, set EMAIL_ACCESS_ALLOWED_PATTERN
 * or EMAIL_ACCESS_ALLOWED_DOMAINS instead; this mutation is for turning an
 * environment policy into a stored one that the console then owns.
 *
 * Idempotent: refuses to overwrite a policy that is already configured, or to
 * take over from the environment, unless `force` is passed.
 */
export const seedEmailAccessPolicy = mutation({
	args: {
		mode: v.union(
			v.literal("open"),
			v.literal("domains"),
			v.literal("pattern"),
		),
		allowedDomains: v.optional(v.array(v.string())),
		allowedEmailPattern: v.optional(v.string()),
		allowClerkTestEmails: v.optional(v.boolean()),
		force: v.optional(v.boolean()),
	},
	handler: async (ctx, { force = false, ...policy }) => {
		const { normalizedEmail } = await assertAppAdmin(ctx);

		const existing = await getAppSettingsDoc(ctx);
		if (existing?.emailAccess && !force) {
			return { seeded: false, reason: "already-configured" as const };
		}
		if (EMAIL_ACCESS_ENV.policy && !existing?.emailAccess && !force) {
			// The environment is already enforcing a policy. Writing a row here
			// would silently take over from it, which is surprising when the two
			// disagree; saving from the console is the explicit way to do that.
			return { seeded: false, reason: "environment-policy" as const };
		}

		if (policy.mode === "domains") {
			const allowedDomains = normalizeDomains(policy.allowedDomains);
			if (allowedDomains.length === 0) {
				throw new Error("Domain mode needs at least one valid domain");
			}
			await patchSettings(
				ctx,
				{
					emailAccess: {
						mode: "domains",
						allowedDomains,
						allowClerkTestEmails: policy.allowClerkTestEmails === true,
					},
				},
				normalizedEmail,
			);
			return { seeded: true, mode: "domains" as const };
		}

		if (policy.mode === "pattern") {
			const pattern = policy.allowedEmailPattern?.trim() ?? "";
			if (!isValidEmailPattern(pattern)) {
				throw new Error("Pattern must be a valid regular expression");
			}
			await patchSettings(
				ctx,
				{
					emailAccess: {
						mode: "pattern",
						allowedEmailPattern: pattern,
						allowClerkTestEmails: policy.allowClerkTestEmails === true,
					},
				},
				normalizedEmail,
			);
			return { seeded: true, mode: "pattern" as const };
		}

		await patchSettings(
			ctx,
			{
				emailAccess: {
					mode: "open",
					allowClerkTestEmails: policy.allowClerkTestEmails === true,
				},
			},
			normalizedEmail,
		);
		return { seeded: true, mode: "open" as const };
	},
});

export const setFeatureToggle = mutation({
	args: { key: v.string(), enabled: v.boolean() },
	handler: async (ctx, { key, enabled }) => {
		const { normalizedEmail } = await assertAppAdmin(ctx);

		// The schema validator for featureToggles is a loose record, so the
		// registry is what stops it becoming a junk drawer of dead keys.
		if (!isAppFeatureKey(key)) {
			throw new Error(`Unknown feature: ${key}`);
		}

		const existing = await getAppSettingsDoc(ctx);
		await patchSettings(
			ctx,
			{
				featureToggles: { ...(existing?.featureToggles ?? {}), [key]: enabled },
			},
			normalizedEmail,
		);
		return { key, enabled };
	},
});

export const updateOps = mutation({
	args: {
		retentionDays: v.optional(v.number()),
		assignmentFeedLength: v.optional(v.number()),
		backupsPerTeam: v.optional(v.number()),
		debugMessageLimit: v.optional(v.number()),
		defaultEventDurationMinutes: v.optional(v.number()),
		birthdayNotifyLocalHour: v.optional(v.number()),
		defaultTeamTimezone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { normalizedEmail } = await assertAppAdmin(ctx);

		const timezone = args.defaultTeamTimezone?.trim();
		if (timezone) {
			// A bad IANA zone would throw deep inside the availability helpers
			// on every assignment, so reject it at the boundary.
			try {
				new Intl.DateTimeFormat("en-US", { timeZone: timezone });
			} catch {
				throw new Error(`Not a valid IANA time zone: ${timezone}`);
			}
		}

		// Clamped on write as well as on read: a stored value can also come
		// from an older version or a hand-edited row.
		const ops = {
			retentionDays: clampInteger(
				args.retentionDays,
				OPS_BOUNDS.retentionDays,
				DEFAULT_OPS.retentionDays,
			),
			assignmentFeedLength: clampInteger(
				args.assignmentFeedLength,
				OPS_BOUNDS.assignmentFeedLength,
				DEFAULT_OPS.assignmentFeedLength,
			),
			backupsPerTeam: clampInteger(
				args.backupsPerTeam,
				OPS_BOUNDS.backupsPerTeam,
				DEFAULT_OPS.backupsPerTeam,
			),
			debugMessageLimit: clampInteger(
				args.debugMessageLimit,
				OPS_BOUNDS.debugMessageLimit,
				DEFAULT_OPS.debugMessageLimit,
			),
			defaultEventDurationMinutes: clampInteger(
				args.defaultEventDurationMinutes,
				OPS_BOUNDS.defaultEventDurationMinutes,
				DEFAULT_OPS.defaultEventDurationMinutes,
			),
			birthdayNotifyLocalHour: clampInteger(
				args.birthdayNotifyLocalHour,
				OPS_BOUNDS.birthdayNotifyLocalHour,
				DEFAULT_OPS.birthdayNotifyLocalHour,
			),
			defaultTeamTimezone:
				timezone && timezone.length > 0 ? timezone : undefined,
		};

		await patchSettings(ctx, { ops }, normalizedEmail);
		return ops;
	},
});
