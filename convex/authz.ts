import { v } from "convex/values";
import {
	canAdministerTeam,
	isTeamOwner,
	resolveReviewerRole,
	teamHasOwner,
} from "../lib/teamRoles";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalQuery,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";

export type AuthCtx = Pick<QueryCtx | MutationCtx, "auth" | "db">;

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

/**
 * Break-glass roster. Read once at module load, which is fine precisely
 * because it comes from the environment and cannot change without a restart.
 * It is checked BEFORE the database so a damaged or emptied `appAdmins` table
 * can never lock an operator out of their own instance.
 */
const ENV_ADMIN_ALLOWLIST = parseAllowlist(ADMIN_ALLOWLIST_EMAILS_RAW);

export function normalizeEmail(
	email: string | null | undefined,
): string | null {
	if (!email) return null;
	const normalized = email.trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
}

/** Env-allowlist membership only. Exported so the console can show which admins are not removable. */
export function isEnvAdminEmail(email: string | null | undefined): boolean {
	const normalized = normalizeEmail(email);
	if (!normalized) return false;
	return ENV_ADMIN_ALLOWLIST.has(normalized);
}

export function getEnvAdminEmails(): string[] {
	return [...ENV_ADMIN_ALLOWLIST].sort();
}

/**
 * Admin check against the env allowlist first, then the `appAdmins` table.
 *
 * `ctx` is a required first parameter rather than an optional convenience: an
 * async predicate called without `await` is a Promise, and `if (promise)` is
 * always truthy while remaining valid TypeScript. Requiring `ctx` turns every
 * un-migrated call site into a compile error instead of a silent grant of
 * admin to every signed-in user.
 */
export async function isAdminEmail(
	ctx: AuthCtx,
	email: string | null | undefined,
): Promise<boolean> {
	const normalized = normalizeEmail(email);
	if (!normalized) return false;
	if (ENV_ADMIN_ALLOWLIST.has(normalized)) return true;
	const row = await ctx.db
		.query("appAdmins")
		.withIndex("by_email", (q) => q.eq("email", normalized))
		.first();
	return row !== null;
}

/** Actions have no `ctx.db`, so they reach the check through this. */
export const isAdminEmailInternal = internalQuery({
	args: { email: v.optional(v.string()) },
	handler: async (ctx, { email }) => isAdminEmail(ctx, email ?? null),
});

/** Global-admin gate for the admin console and every app-wide mutation. */
export async function assertAppAdmin(ctx: AuthCtx): Promise<{
	identity: Identity;
	normalizedEmail: string | null;
}> {
	const identity = await requireIdentity(ctx);
	if (!(await isAdminEmail(ctx, identity.email))) {
		throw new Error("Unauthorized");
	}
	return { identity, normalizedEmail: normalizeEmail(identity.email) };
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
	// Avoid scanning the whole team: use the compound index.
	const match = await ctx.db
		.query("reviewers")
		.withIndex("by_team_email", (q) =>
			q.eq("teamId", teamId).eq("email", normalizedEmail),
		)
		.first();
	return match !== null;
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
	if (await isAdminEmail(ctx, identity.email)) {
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

/**
 * Owner-level gate for destructive or team-wide actions.
 *
 * Same shape as assertCanMutateTeamById so it is a drop-in swap at a call
 * site. Throws the distinct sentinel "TeamOwnerRequired" rather than a bare
 * "Unauthorized" so the UI can say "ask a team owner" instead of implying the
 * person does not belong to the team at all.
 *
 * A team with no owner at all is grandfathered to member level: every row
 * predating the roles migration has `role: undefined`, and refusing there
 * would strand the whole team with nobody able to grant the role. The gate
 * turns on per team, by itself, as soon as that team has an owner.
 *
 * Pass `grandfatherOwnerlessTeams: false` for actions that must never be
 * reachable that way. Granting the role is the one such action: otherwise the
 * first member to click could seize a team the backfill has not reached yet.
 */
export async function assertCanAdministerTeamById(
	ctx: AuthCtx,
	teamId: Id<"teams">,
	{
		grandfatherOwnerlessTeams = true,
	}: { grandfatherOwnerlessTeams?: boolean } = {},
): Promise<{
	identity: Identity;
	isAdmin: boolean;
	normalizedEmail: string | null;
	reviewer: Doc<"reviewers"> | null;
	/** True when the team has no owner yet and the gate stood down. */
	grandfathered: boolean;
}> {
	const identity = await requireIdentity(ctx);
	if (await isAdminEmail(ctx, identity.email)) {
		return {
			identity,
			isAdmin: true,
			normalizedEmail: normalizeEmail(identity.email),
			reviewer: null,
			grandfathered: false,
		};
	}

	const normalizedEmail = normalizeEmail(identity.email);
	if (!normalizedEmail) {
		throw new Error("Unauthorized");
	}

	const reviewer = await ctx.db
		.query("reviewers")
		.withIndex("by_team_email", (q) =>
			q.eq("teamId", teamId).eq("email", normalizedEmail),
		)
		.first();
	if (!reviewer) {
		throw new Error("Unauthorized");
	}

	const isOwner = isTeamOwner(reviewer);
	if (isOwner) {
		return {
			identity,
			isAdmin: false,
			normalizedEmail,
			reviewer,
			grandfathered: false,
		};
	}

	// Only reached when the caller is not an owner, so the scan costs nothing
	// on the happy path. Tens of rows, read through the by_team index.
	const roster = await ctx.db
		.query("reviewers")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.collect();
	const hasOwner = teamHasOwner(roster);

	if (
		!grandfatherOwnerlessTeams ||
		!canAdministerTeam({ isOwner, teamHasOwner: hasOwner })
	) {
		throw new Error("TeamOwnerRequired");
	}

	return {
		identity,
		isAdmin: false,
		normalizedEmail,
		reviewer,
		grandfathered: true,
	};
}

/**
 * Refuses a change that would leave a team with nobody able to administer it.
 *
 * Enforced at the four places a roster can lose its owners: removing a
 * reviewer, demoting one, and the two mutations that replace the whole roster
 * (importReviewersData, restoreFromBackup), neither of whose payloads carries
 * a role.
 */
export async function assertTeamRetainsOwner(
	ctx: AuthCtx,
	teamId: Id<"teams">,
	{
		excluding,
		demoting,
	}: { excluding?: Id<"reviewers">; demoting?: Id<"reviewers"> } = {},
): Promise<void> {
	const reviewers = await ctx.db
		.query("reviewers")
		.withIndex("by_team", (q) => q.eq("teamId", teamId))
		.collect();

	// Nothing to preserve on a team that has no owner yet: every row predating
	// the roles migration is `role: undefined`, and refusing here would make it
	// impossible to remove anyone from a team the backfill has not reached.
	if (!teamHasOwner(reviewers)) return;

	const retains = reviewers.some((reviewer) => {
		if (excluding !== undefined && reviewer._id === excluding) return false;
		if (demoting !== undefined && reviewer._id === demoting) return false;
		return resolveReviewerRole(reviewer) === "owner";
	});

	if (!retains) {
		throw new Error("Team must keep at least one owner");
	}
}

export async function getMemberTeamIdsForEmail(
	ctx: AuthCtx,
	normalizedEmail: string,
): Promise<Id<"teams">[]> {
	// Avoid full table scan: reviewers has an index on email.
	const reviewers = await ctx.db
		.query("reviewers")
		.withIndex("by_email", (q) => q.eq("email", normalizedEmail))
		.collect();
	const teamIds = reviewers
		.map((reviewer) => reviewer.teamId)
		.filter((teamId): teamId is Id<"teams"> => teamId !== undefined);
	return [...new Set(teamIds)];
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

export async function assertAgentTokenCanAccessTeamId(
	ctx: AuthCtx,
	tokenHash: string,
	teamId: Id<"teams">,
) {
	const token = await ctx.db
		.query("agentTokens")
		.withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
		.first();

	if (!token || token.revokedAt) {
		throw new Error("Unauthorized");
	}

	const normalizedEmail = normalizeEmail(token.email);
	if (!normalizedEmail) {
		throw new Error("Unauthorized");
	}

	if (await isAdminEmail(ctx, normalizedEmail)) {
		return;
	}

	const memberTeamIds = await getMemberTeamIdsForEmail(ctx, normalizedEmail);
	if (!memberTeamIds.includes(teamId)) {
		throw new Error("Unauthorized");
	}
}
