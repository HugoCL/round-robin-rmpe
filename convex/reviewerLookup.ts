import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { normalizeEmail } from "./authz";

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;

type IdentityLike = {
	email?: string | null;
	name?: string | null;
	givenName?: string | null;
	familyName?: string | null;
};

export function identityDisplayName(
	identity: IdentityLike | null | undefined,
): string | undefined {
	const fullName = identity?.name?.trim();
	if (fullName) return fullName;
	const parts = [identity?.givenName, identity?.familyName]
		.map((part) => part?.trim())
		.filter((part): part is string => Boolean(part));
	if (parts.length > 0) {
		return parts.join(" ");
	}
	return undefined;
}

/**
 * Find a reviewer by email across every team, preferring the requesting team
 * when the same person exists in more than one roster.
 */
export async function findReviewerByEmailAnyTeam(
	ctx: DbCtx,
	email: string | null | undefined,
	preferredTeamId?: Id<"teams">,
): Promise<Doc<"reviewers"> | null> {
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail) return null;

	if (preferredTeamId) {
		const preferred = await ctx.db
			.query("reviewers")
			.withIndex("by_team_email", (q) =>
				q.eq("teamId", preferredTeamId).eq("email", normalizedEmail),
			)
			.first();
		if (preferred) return preferred;
	}

	const matches = await ctx.db
		.query("reviewers")
		.withIndex("by_email", (q) => q.eq("email", normalizedEmail))
		.collect();
	if (matches.length === 0) return null;
	return matches.find((reviewer) => reviewer.teamId) ?? matches[0] ?? null;
}

export async function resolveAssignmentActor(
	ctx: MutationCtx,
	options: {
		actionByReviewerId?: Id<"reviewers">;
		preferredTeamId?: Id<"teams">;
		agentTokenHash?: string;
		fallbackName?: string;
	},
): Promise<{
	actionByReviewerId?: Id<"reviewers">;
	actionByName?: string;
	assigner?: Doc<"reviewers">;
}> {
	if (options.actionByReviewerId) {
		const assigner = await ctx.db.get(options.actionByReviewerId);
		if (assigner) {
			return {
				actionByReviewerId: assigner._id,
				actionByName: assigner.name,
				assigner,
			};
		}
	}

	const identity = await ctx.auth.getUserIdentity();
	let email = normalizeEmail(identity?.email);
	const fallbackName =
		options.fallbackName?.trim() || identityDisplayName(identity);

	if (!email && options.agentTokenHash) {
		const token = await ctx.db
			.query("agentTokens")
			.withIndex("by_token_hash", (q) =>
				q.eq("tokenHash", options.agentTokenHash as string),
			)
			.first();
		email = normalizeEmail(token?.email);
	}

	if (email) {
		const assigner = await findReviewerByEmailAnyTeam(
			ctx,
			email,
			options.preferredTeamId,
		);
		if (assigner) {
			return {
				actionByReviewerId: assigner._id,
				actionByName: assigner.name,
				assigner,
			};
		}
	}

	if (fallbackName) {
		return { actionByName: fallbackName };
	}
	return {};
}
