import { Migrations } from "@convex-dev/migrations";
import { normalizeSurveyOption, pickSurveyLocaleText } from "../lib/surveys";
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

export const removeAlwaysSendGoogleChatMessagePreference = migrations.define({
	table: "userPreferences",
	migrateOne: async (_ctx, preference) => {
		if (preference.alwaysSendGoogleChatMessage === undefined) return;
		return { alwaysSendGoogleChatMessage: undefined };
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

export const migrateSurveysToSpanishOnly = migrations.define({
	table: "surveys",
	migrateOne: async (ctx, survey) => {
		const legacy = survey as typeof survey & {
			titleEn?: string;
			titleEs?: string;
			descriptionEn?: string;
			descriptionEs?: string;
		};
		const title =
			pickSurveyLocaleText(legacy.title, legacy.titleEs, legacy.titleEn) ||
			"Encuesta";
		const description =
			pickSurveyLocaleText(
				legacy.description,
				legacy.descriptionEs,
				legacy.descriptionEn,
			) || undefined;

		const alreadyMigrated =
			legacy.title === title &&
			legacy.description === description &&
			legacy.titleEn === undefined &&
			legacy.titleEs === undefined &&
			legacy.descriptionEn === undefined &&
			legacy.descriptionEs === undefined;
		if (alreadyMigrated) {
			return;
		}

		await ctx.db.replace(survey._id, {
			title,
			description,
			status: survey.status,
			deadlineAt: survey.deadlineAt,
			createdByTokenIdentifier: survey.createdByTokenIdentifier,
			createdAt: survey.createdAt,
			updatedAt: Date.now(),
		});
	},
});

export const migrateSurveyQuestionsToSpanishOnly = migrations.define({
	table: "surveyQuestions",
	migrateOne: async (ctx, question) => {
		type LegacyOption = {
			value: string;
			label?: string;
			labelEn?: string;
			labelEs?: string;
		};
		const legacy = question as Omit<typeof question, "prompt" | "options"> & {
			prompt?: string;
			promptEn?: string;
			promptEs?: string;
			options: LegacyOption[];
		};
		const prompt =
			pickSurveyLocaleText(legacy.prompt, legacy.promptEs, legacy.promptEn) ||
			"Pregunta";
		const options = legacy.options.map(normalizeSurveyOption);
		const alreadyMigrated =
			legacy.prompt === prompt &&
			legacy.promptEn === undefined &&
			legacy.promptEs === undefined &&
			legacy.options.every(
				(option, index) =>
					option.label === options[index]?.label &&
					option.labelEn === undefined &&
					option.labelEs === undefined,
			);
		if (alreadyMigrated) {
			return;
		}

		await ctx.db.replace(question._id, {
			surveyId: question.surveyId,
			order: question.order,
			type: question.type,
			prompt,
			options,
			required: question.required,
		});
	},
});

export const run = migrations.runner();

export const runBackfillUserPreferenceDefaultTeamSlug = migrations.runner(
	internal.migrations.backfillUserPreferenceDefaultTeamSlug,
);

export const runRemoveAlwaysSendGoogleChatMessagePreference = migrations.runner(
	internal.migrations.removeAlwaysSendGoogleChatMessagePreference,
);

export const runMigrateSurveysToSpanishOnly = migrations.runner([
	internal.migrations.migrateSurveysToSpanishOnly,
	internal.migrations.migrateSurveyQuestionsToSpanishOnly,
]);

export const runAll = migrations.runner([
	internal.migrations.backfillReviewerTeamId,
	internal.migrations.backfillUserPreferenceDefaultTeamSlug,
	internal.migrations.migrateSurveysToSpanishOnly,
	internal.migrations.migrateSurveyQuestionsToSpanishOnly,
]);
