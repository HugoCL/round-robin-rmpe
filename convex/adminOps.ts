import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { assertAppAdmin, normalizeEmail } from "./authz";
import { migrations } from "./migrations";

/**
 * Everything that used to require `npx convex run` plus a deployment admin key.
 *
 * Two different shapes, because Convex forbids a mutation calling a mutation:
 *  - maintenance tasks run from an ACTION, which can `ctx.runMutation` the
 *    internal cron targets and get their result synchronously;
 *  - migrations run from a MUTATION, because the @convex-dev/migrations client
 *    takes a MutationCtx directly.
 */

/**
 * Whitelist of runnable tasks. Plain strings, deliberately: holding
 * FunctionReference values in a module-level const forces TypeScript to
 * resolve the whole generated api type from inside a module that is itself
 * part of it, which degrades inference across the app. The references are
 * resolved inside the handler instead.
 */
const MAINTENANCE_TASKS = [
	{ key: "cleanup_old_records", destructive: true },
	{ key: "cleanup_feed_drift", destructive: false },
	{ key: "cleanup_legacy_pr_status", destructive: false },
	{ key: "process_absent_returns", destructive: false },
	{ key: "auto_complete_expired_events", destructive: false },
	{ key: "audit_reviewer_teams", destructive: false },
	{ key: "assert_reviewer_teams_ready", destructive: false },
	{ key: "backfill_assignment_history_names", destructive: false },
] as const;

export type MaintenanceTaskKey = (typeof MAINTENANCE_TASKS)[number]["key"];

function isMaintenanceTaskKey(value: string): value is MaintenanceTaskKey {
	return MAINTENANCE_TASKS.some((task) => task.key === value);
}

export const listMaintenanceTasks = query({
	args: {},
	handler: async (ctx) => {
		await assertAppAdmin(ctx);
		const runs = await ctx.db
			.query("maintenanceRuns")
			.withIndex("by_started_at")
			.order("desc")
			.take(20);
		return { tasks: MAINTENANCE_TASKS, runs };
	},
});

export const runMaintenanceTask = action({
	args: { task: v.string() },
	// Explicit return type: this handler references internal.adminOps, i.e.
	// its own module, and without an annotation the api type becomes circular
	// and every inferred query result in the app degrades to `any`.
	handler: async (
		ctx,
		{ task },
	): Promise<{ task: string; status: "succeeded"; result: unknown }> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthorized");
		const email = normalizeEmail(identity.email);
		const isAdmin = await ctx.runQuery(internal.authz.isAdminEmailInternal, {
			email: email ?? undefined,
		});
		if (!isAdmin) throw new Error("Unauthorized");

		if (!isMaintenanceTaskKey(task)) {
			throw new Error(`Unknown maintenance task: ${task}`);
		}

		const startedAt = Date.now();
		try {
			const result = await ctx.runMutation(resolveTaskRef(task), {});
			await ctx.runMutation(internal.maintenanceLog.recordMaintenanceRun, {
				task,
				dryRun: false,
				status: "succeeded",
				startedAt,
				triggeredByEmail: email ?? "unknown",
				resultJson: JSON.stringify(result ?? null).slice(0, 4000),
			});
			return { task, status: "succeeded" as const, result };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await ctx.runMutation(internal.maintenanceLog.recordMaintenanceRun, {
				task,
				dryRun: false,
				status: "failed",
				startedAt,
				triggeredByEmail: email ?? "unknown",
				error: message.slice(0, 1000),
			});
			throw error;
		}
	},
});

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

/** Names only, for the same inference reason as MAINTENANCE_TASKS. */
const MIGRATION_NAMES = [
	"backfillReviewerTeamId",
	"backfillUserPreferenceDefaultTeamSlug",
	"removeAlwaysSendGoogleChatMessagePreference",
	"migrateSurveysToSpanishOnly",
	"migrateSurveyQuestionsToSpanishOnly",
] as const;

type MigrationName = (typeof MIGRATION_NAMES)[number];

function isMigrationName(value: string): value is MigrationName {
	return (MIGRATION_NAMES as readonly string[]).includes(value);
}

function resolveMigrationRef(name: MigrationName) {
	switch (name) {
		case "backfillReviewerTeamId":
			return internal.migrations.backfillReviewerTeamId;
		case "backfillUserPreferenceDefaultTeamSlug":
			return internal.migrations.backfillUserPreferenceDefaultTeamSlug;
		case "removeAlwaysSendGoogleChatMessagePreference":
			return internal.migrations.removeAlwaysSendGoogleChatMessagePreference;
		case "migrateSurveysToSpanishOnly":
			return internal.migrations.migrateSurveysToSpanishOnly;
		case "migrateSurveyQuestionsToSpanishOnly":
			return internal.migrations.migrateSurveyQuestionsToSpanishOnly;
		default: {
			const _exhaustive: never = name;
			return _exhaustive;
		}
	}
}

export const listMigrations = query({
	args: {},
	handler: async (ctx): Promise<{ names: string[]; status: unknown }> => {
		await assertAppAdmin(ctx);
		// Reactive, so the console shows live progress without polling.
		const status = await migrations.getStatus(ctx, { limit: 20 });
		return { names: [...MIGRATION_NAMES], status };
	},
});

export const startMigration = mutation({
	args: {
		name: v.string(),
		dryRun: v.optional(v.boolean()),
		reset: v.optional(v.boolean()),
	},
	handler: async (
		ctx,
		{ name, dryRun = true, reset },
	): Promise<{
		name: string;
		dryRun: boolean;
		ok: boolean;
		rolledBack: boolean;
		result?: unknown;
		detail?: string;
	}> => {
		await assertAppAdmin(ctx);
		if (!isMigrationName(name)) throw new Error(`Unknown migration: ${name}`);

		try {
			const result = await migrations.runOne(ctx, resolveMigrationRef(name), {
				dryRun,
				reset,
			});
			return { name, dryRun, ok: true, rolledBack: false, result };
		} catch (error) {
			// A dry run reports BY THROWING, so the transaction rolls back. A
			// throw here is the expected outcome, not a failure. Reporting it as
			// an error would show red for a successful preview.
			if (dryRun) {
				return {
					name,
					dryRun,
					ok: true,
					rolledBack: true,
					detail: String(error).slice(0, 1000),
				};
			}
			throw error;
		}
	},
});

export const cancelMigration = mutation({
	args: { name: v.string() },
	handler: async (ctx, { name }): Promise<unknown> => {
		await assertAppAdmin(ctx);
		if (!isMigrationName(name)) throw new Error(`Unknown migration: ${name}`);
		return migrations.cancel(ctx, resolveMigrationRef(name));
	},
});

// ---------------------------------------------------------------------------
// Data corrections that had no mutation at all before
// ---------------------------------------------------------------------------

/** The global counter on the public landing page. Only ever incremented before. */
export const resetGlobalReviewedPRCounter = mutation({
	args: { value: v.optional(v.number()) },
	handler: async (ctx, { value = 0 }) => {
		await assertAppAdmin(ctx);
		if (!Number.isFinite(value) || value < 0) {
			throw new Error("Counter must be zero or a positive number");
		}
		const rows = await ctx.db
			.query("appMetrics")
			.withIndex("by_key", (q) => q.eq("key", "reviewed_pr_total"))
			.collect();

		if (rows.length === 0) {
			await ctx.db.insert("appMetrics", {
				key: "reviewed_pr_total",
				value: Math.round(value),
				updatedAt: Date.now(),
			});
			return { value: Math.round(value) };
		}

		// Collapse any duplicate rows: the public query sums them.
		for (const row of rows.slice(1)) await ctx.db.delete(row._id);
		await ctx.db.patch(rows[0]._id, {
			value: Math.round(value),
			updatedAt: Date.now(),
		});
		return { value: Math.round(value) };
	},
});

/** debugMessages is write-only from the app and had no purge path. */
export const purgeDebugMessages = mutation({
	args: {},
	handler: async (ctx) => {
		await assertAppAdmin(ctx);
		const rows = await ctx.db.query("debugMessages").collect();
		for (const row of rows) await ctx.db.delete(row._id);
		return { deleted: rows.length };
	},
});

/** Resolved here rather than at module scope: see the note on MAINTENANCE_TASKS. */
function resolveTaskRef(task: MaintenanceTaskKey) {
	switch (task) {
		case "cleanup_old_records":
			return internal.mutations.cleanupOldRecords;
		case "cleanup_feed_drift":
			return internal.mutations.cleanupAssignmentFeedSchemaDrift;
		case "cleanup_legacy_pr_status":
			return internal.mutations.cleanupLegacyPRAssignmentStatus;
		case "process_absent_returns":
			return internal.mutations.processAbsentReturns;
		case "auto_complete_expired_events":
			return internal.mutations.autoCompleteExpiredEvents;
		case "audit_reviewer_teams":
			return internal.mutations.auditReviewerTeamAssignments;
		case "assert_reviewer_teams_ready":
			return internal.mutations.assertReviewerTeamsBackfillReady;
		case "backfill_assignment_history_names":
			return internal.mutations.backfillAssignmentHistoryNames;
		default: {
			const _exhaustive: never = task;
			return _exhaustive;
		}
	}
}
