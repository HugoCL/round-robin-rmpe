import { v } from "convex/values";
import { formatUnverifiedSessionLog } from "../lib/sessionUnverifiedReport";
import { mutation } from "./_generated/server";

/**
 * One line in the Convex logs when the board shows "session unverified".
 *
 * That screen means Clerk has a user and Convex does not, so requiring a
 * session here would drop the only report we can get. Nothing is stored.
 */
export const reportUnverifiedSession = mutation({
	args: {
		clientTimestamp: v.number(),
		clerkUserId: v.optional(v.string()),
		clerkEmail: v.optional(v.string()),
		tokenStatus: v.union(
			v.literal("present"),
			v.literal("missing"),
			v.literal("error"),
		),
		tokenError: v.optional(v.string()),
		iss: v.optional(v.string()),
		aud: v.optional(v.string()),
		iat: v.optional(v.number()),
		exp: v.optional(v.number()),
		route: v.string(),
		userAgent: v.string(),
		retryCount: v.number(),
	},
	returns: v.null(),
	handler: async (_ctx, args) => {
		console.warn(formatUnverifiedSessionLog(args, Date.now()));
		return null;
	},
});
