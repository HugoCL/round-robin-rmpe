import { v } from "convex/values";
import { pickTeamOwnerCandidate, resolveReviewerRole } from "../lib/teamRoles";
import { mutation, query } from "./_generated/server";
import {
	assertAppAdmin,
	assertCanAdministerTeamById,
	assertTeamRetainsOwner,
} from "./authz";

/**
 * Assigns an owner to every team that has none.
 *
 * Dry-run by default and reports its choice per team, because it runs once
 * against live data and a wrong pick is only visible if someone looks. Getting
 * it wrong is recoverable: global admins bypass roles entirely, and the
 * console can change an owner in one click.
 */
export const backfillTeamOwners = mutation({
	args: { dryRun: v.optional(v.boolean()) },
	handler: async (ctx, { dryRun = true }) => {
		await assertAppAdmin(ctx);

		const teams = await ctx.db.query("teams").collect();
		const report: Array<{
			teamSlug: string;
			owner: string | null;
			tiedCount: number;
			filteredSeedRows: boolean;
			alreadyHadOwner: boolean;
			rosterSize: number;
		}> = [];

		for (const team of teams) {
			const reviewers = await ctx.db
				.query("reviewers")
				.withIndex("by_team", (q) => q.eq("teamId", team._id))
				.collect();

			const existingOwner = reviewers.find(
				(reviewer) => resolveReviewerRole(reviewer) === "owner",
			);
			if (existingOwner) {
				report.push({
					teamSlug: team.slug,
					owner: existingOwner.email,
					tiedCount: 0,
					filteredSeedRows: false,
					alreadyHadOwner: true,
					rosterSize: reviewers.length,
				});
				continue;
			}

			const pick = pickTeamOwnerCandidate(reviewers);
			report.push({
				teamSlug: team.slug,
				owner: pick.owner?.email ?? null,
				tiedCount: pick.tiedCount,
				filteredSeedRows: pick.filteredSeedRows,
				alreadyHadOwner: false,
				rosterSize: reviewers.length,
			});

			if (dryRun || !pick.owner) continue;

			for (const reviewer of reviewers) {
				await ctx.db.patch(reviewer._id, {
					role: reviewer._id === pick.owner._id ? "owner" : "member",
				});
			}
		}

		return {
			dryRun,
			teamsWithoutOwner: report.filter(
				(entry) => !entry.alreadyHadOwner && entry.owner === null,
			).length,
			teamsChanged: report.filter((entry) => !entry.alreadyHadOwner).length,
			report,
		};
	},
});

/** Teams nobody can administer. Should read zero once the backfill has run. */
export const listTeamsWithoutOwner = query({
	args: {},
	handler: async (ctx) => {
		await assertAppAdmin(ctx);
		const teams = await ctx.db.query("teams").collect();
		const orphaned: Array<{ slug: string; name: string; rosterSize: number }> =
			[];

		for (const team of teams) {
			const reviewers = await ctx.db
				.query("reviewers")
				.withIndex("by_team", (q) => q.eq("teamId", team._id))
				.collect();
			const hasOwner = reviewers.some(
				(reviewer) => resolveReviewerRole(reviewer) === "owner",
			);
			if (!hasOwner) {
				orphaned.push({
					slug: team.slug,
					name: team.name,
					rosterSize: reviewers.length,
				});
			}
		}

		return orphaned;
	},
});

export const setReviewerRole = mutation({
	args: {
		reviewerId: v.id("reviewers"),
		role: v.union(v.literal("owner"), v.literal("member")),
	},
	handler: async (ctx, { reviewerId, role }) => {
		const reviewer = await ctx.db.get(reviewerId);
		if (!reviewer) throw new Error("Reviewer not found");
		if (!reviewer.teamId)
			throw new Error("Reviewer is missing team assignment");

		// No grandfathering here: on a team the backfill has not reached, the
		// first owner is granted by the backfill or a global admin, never
		// claimed by whichever member gets there first.
		await assertCanAdministerTeamById(ctx, reviewer.teamId, {
			grandfatherOwnerlessTeams: false,
		});

		if (role === "member") {
			await assertTeamRetainsOwner(ctx, reviewer.teamId, {
				demoting: reviewerId,
			});
		}

		await ctx.db.patch(reviewerId, { role });
		return { reviewerId, role };
	},
});
