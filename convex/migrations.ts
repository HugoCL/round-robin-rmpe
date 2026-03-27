import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";

export const migrations = new Migrations<DataModel>(components.migrations);

export const backfillUserPreferenceDefaultTeamSlug = migrations.define({
	table: "userPreferences",
	migrateOne: async (ctx, preference) => {
		if (preference.defaultAgentTeamSlug) {
			return;
		}

		const normalizedEmail = preference.email?.trim().toLowerCase();
		if (!normalizedEmail) {
			return;
		}

		const matchingReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_email", (q) => q.eq("email", normalizedEmail))
			.collect();
		const teamIds = [
			...new Set(
				matchingReviewers
					.filter(
						(reviewer) => reviewer.email.toLowerCase() === normalizedEmail,
					)
					.map((reviewer) => reviewer.teamId)
					.filter((teamId): teamId is Id<"teams"> => teamId !== undefined),
			),
		];

		if (teamIds.length !== 1) {
			return;
		}

		const team = await ctx.db.get(teamIds[0]);
		if (!team?.slug) {
			return;
		}

		return {
			defaultAgentTeamSlug: team.slug,
			updatedAt: Date.now(),
		};
	},
});

export const backfillReviewerTeamId = migrations.define({
	table: "reviewers",
	migrateOne: async (ctx, reviewer) => {
		if (reviewer.teamId) {
			return;
		}

		const normalizedEmail = reviewer.email.trim().toLowerCase();
		const sameEmailReviewers = await ctx.db
			.query("reviewers")
			.withIndex("by_email", (q) => q.eq("email", normalizedEmail))
			.collect();
		const candidateTeamIds = [
			...new Set(
				sameEmailReviewers
					.map((item) => item.teamId)
					.filter((teamId): teamId is Id<"teams"> => teamId !== undefined),
			),
		];

		if (candidateTeamIds.length === 1) {
			return { teamId: candidateTeamIds[0] };
		}

		const teams = await ctx.db.query("teams").collect();
		if (teams.length === 1) {
			return { teamId: teams[0]._id };
		}

		return;
	},
});

export const run = migrations.runner();

export const runBackfillUserPreferenceDefaultTeamSlug = migrations.runner(
	internal.migrations.backfillUserPreferenceDefaultTeamSlug,
);

export const runAll = migrations.runner([
	internal.migrations.backfillReviewerTeamId,
	internal.migrations.backfillUserPreferenceDefaultTeamSlug,
]);
