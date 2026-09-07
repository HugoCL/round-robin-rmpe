import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * The maintenance audit trail lives in its own module on purpose.
 *
 * `runMaintenanceTask` in adminOps needs to write a row, and a module that
 * references `internal.<itself>` makes the generated api type circular, which
 * silently degrades every inferred query result in the app to `any`.
 */
export const recordMaintenanceRun = internalMutation({
	args: {
		task: v.string(),
		dryRun: v.boolean(),
		status: v.union(
			v.literal("running"),
			v.literal("succeeded"),
			v.literal("failed"),
		),
		startedAt: v.number(),
		triggeredByEmail: v.string(),
		resultJson: v.optional(v.string()),
		error: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("maintenanceRuns", {
			...args,
			finishedAt: Date.now(),
		});
	},
});
