import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type AuthCtx = Pick<QueryCtx | MutationCtx, "auth" | "db">;

type Identity = NonNullable<
	Awaited<ReturnType<AuthCtx["auth"]["getUserIdentity"]>>
>;

const ADMIN_ALLOWLIST_EMAILS_RAW =
	process.env.ADMIN_ALLOWLIST_EMAILS ?? process.env.ADMIN_EMAIL_ALLOWLIST ?? "";

function parseAllowlist(raw: string): Set<string> {
	const entries = raw
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter((value) => value.length > 0);
	return new Set(entries);
}

const ADMIN_ALLOWLIST_EMAILS = parseAllowlist(ADMIN_ALLOWLIST_EMAILS_RAW);

export function normalizeEmail(
	email: string | null | undefined,
): string | null {
	if (!email) return null;
	const normalized = email.trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
	const normalized = normalizeEmail(email);
	if (!normalized) return false;
	return ADMIN_ALLOWLIST_EMAILS.has(normalized);
}

export async function requireIdentity(ctx: AuthCtx): Promise<Identity> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Unauthorized");
	}
	return identity;
}

async function isMemberOfTeamByEmail(
	ctx: AuthCtx,
	teamId: Id<"teams">,
	normalizedEmail: string,
): Promise<boolean> {
	const teamReviewers = await ctx.db
		.query("reviewers")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.collect();
	return teamReviewers.some(
		(reviewer) => normalizeEmail(reviewer.email) === normalizedEmail,
	);
}

export async function assertCanMutateTeamById(
	ctx: AuthCtx,
	teamId: Id<"teams">,
): Promise<{
	identity: Identity;
	isAdmin: boolean;
	normalizedEmail: string | null;
}> {
	const identity = await requireIdentity(ctx);
	if (isAdminEmail(identity.email)) {
		return {
			identity,
			isAdmin: true,
			normalizedEmail: normalizeEmail(identity.email),
		};
	}

	const normalizedEmail = normalizeEmail(identity.email);
	if (!normalizedEmail) {
		throw new Error("Unauthorized");
	}

	const isMember = await isMemberOfTeamByEmail(ctx, teamId, normalizedEmail);
	if (!isMember) {
		throw new Error("Unauthorized");
	}

	return { identity, isAdmin: false, normalizedEmail };
}

export async function getMemberTeamIdsForEmail(
	ctx: AuthCtx,
	normalizedEmail: string,
): Promise<Id<"teams">[]> {
	const reviewers = await ctx.db.query("reviewers").collect();
	const ids = reviewers
		.filter((reviewer) => normalizeEmail(reviewer.email) === normalizedEmail)
		.map((reviewer) => reviewer.teamId)
		.filter((teamId): teamId is Id<"teams"> => teamId !== undefined);
	return [...new Set(ids)];
}

export async function getMemberTeamsForEmail(
	ctx: AuthCtx,
	email: string,
): Promise<Doc<"teams">[]> {
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail) return [];
	const teamIds = await getMemberTeamIdsForEmail(ctx, normalizedEmail);
	const teams = await Promise.all(teamIds.map((teamId) => ctx.db.get(teamId)));
	return teams.filter((team): team is Doc<"teams"> => team !== null);
}
