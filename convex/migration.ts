import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";

type BackfillUserPreferenceTeamsResult = {
	success: boolean;
	dryRun: boolean;
	totalPreferences: number;
	updatedCount: number;
	ambiguousCount: number;
	ambiguous: Array<{ email: string; teamSlugs: string[] }>;
	skippedNoEmailCount: number;
	skippedNoEmail: string[];
};

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

export const backfillUserPreferenceTeams = action({
	args: {
		dryRun: v.optional(v.boolean()),
	},
	handler: async (
		ctx,
		{ dryRun = true },
	): Promise<BackfillUserPreferenceTeamsResult> => {
		return (await ctx.runMutation(
			internal.migrations.runBackfillUserPreferenceDefaultTeamSlug,
			{ dryRun },
		)) as BackfillUserPreferenceTeamsResult;
	},
});
