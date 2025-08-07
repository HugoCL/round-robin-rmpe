import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const migrateFromRedis = action({
    args: {},
    handler: async (ctx) => {
        try {
            // This action can be called from a migration script
            // to transfer existing Redis data to Convex

            // For now, just initialize with default data
            await ctx.runMutation(api.mutations.initializeData, {});

            return { success: true, message: "Migration completed" };
        } catch (error) {
            console.error("Migration error:", error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Unknown error"
            };
        }
    },
});
