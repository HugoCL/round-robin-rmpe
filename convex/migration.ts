import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

export const migrateFromRedis = action({
	args: { teamSlug: v.string() },
	handler: async (ctx, { teamSlug }) => {
		try {
			// This action can be called from a migration script
			// to transfer existing Redis data to Convex

			// For now, just initialize with default data
			await ctx.runMutation(api.mutations.initializeData, { teamSlug });

			return { success: true, message: "Migration completed" };
		} catch (error) {
			console.error("Migration error:", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
