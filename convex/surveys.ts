import { v } from "convex/values";
import {
	aggregateChoiceAnswers,
	canSubmitSurveyResponse,
	getPmfTemplateQuestions,
	getPmfVeryDisappointedPercent,
	isSurveyVisibleToRespondent,
	partitionActiveSurveysForActivation,
	pickWinningCompletionId,
	type SurveyQuestionInput,
	validateSurveyAnswers,
} from "../lib/surveys";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { isAdminEmail, requireIdentity } from "./authz";

const questionTypeValidator = v.union(
	v.literal("single_choice"),
	v.literal("likert"),
	v.literal("free_text"),
);

const optionValidator = v.object({
	value: v.string(),
	label: v.string(),
});

const questionInputValidator = v.object({
	order: v.number(),
	type: questionTypeValidator,
	prompt: v.string(),
	options: v.array(optionValidator),
	required: v.boolean(),
});

function assertAdmin(email: string | null | undefined) {
	if (!isAdminEmail(email)) {
		throw new Error("Unauthorized");
	}
}

function normalizeText(
	value: string,
	{
		min,
		max,
		field,
	}: {
		min: number;
		max: number;
		field: string;
	},
): string {
	const normalized = value.trim();
	if (normalized.length < min || normalized.length > max) {
		throw new Error(`${field} must be between ${min} and ${max} characters`);
	}
	return normalized;
}

function normalizeOptionalText(
	value: string | undefined,
	{
		max,
		field,
	}: {
		max: number;
		field: string;
	},
): string | undefined {
	if (value === undefined) return undefined;
	const normalized = value.trim();
	if (normalized.length === 0) return undefined;
	if (normalized.length > max) {
		throw new Error(`${field} must be at most ${max} characters`);
	}
	return normalized;
}

function validateQuestionInputs(questions: SurveyQuestionInput[]) {
	if (questions.length === 0) {
		throw new Error("Survey must have at least one question");
	}
	if (questions.length > 20) {
		throw new Error("Survey can have at most 20 questions");
	}

	const orders = new Set<number>();
	for (const question of questions) {
		if (orders.has(question.order)) {
			throw new Error("Duplicate question order");
		}
		orders.add(question.order);

		normalizeText(question.prompt, {
			min: 1,
			max: 500,
			field: "prompt",
		});

		if (question.type === "free_text") {
			if (question.options.length > 0) {
				throw new Error("Free-text questions cannot have options");
			}
			continue;
		}

		if (question.options.length < 2) {
			throw new Error("Choice and Likert questions need at least 2 options");
		}

		const values = new Set<string>();
		for (const option of question.options) {
			const value = normalizeText(option.value, {
				min: 1,
				max: 64,
				field: "option value",
			});
			if (values.has(value)) {
				throw new Error("Duplicate option value");
			}
			values.add(value);
			normalizeText(option.label, {
				min: 1,
				max: 200,
				field: "option label",
			});
		}
	}
}

async function listQuestionsForSurvey(
	ctx: QueryCtx | MutationCtx,
	surveyId: Id<"surveys">,
) {
	return ctx.db
		.query("surveyQuestions")
		.withIndex("by_survey_order", (q) => q.eq("surveyId", surveyId))
		.collect();
}

async function replaceSurveyQuestions(
	ctx: MutationCtx,
	surveyId: Id<"surveys">,
	questions: SurveyQuestionInput[],
) {
	validateQuestionInputs(questions);
	const existing = await listQuestionsForSurvey(ctx, surveyId);
	for (const question of existing) {
		await ctx.db.delete(question._id);
	}

	const sorted = [...questions].toSorted((a, b) => a.order - b.order);
	for (const [index, question] of sorted.entries()) {
		await ctx.db.insert("surveyQuestions", {
			surveyId,
			order: index,
			type: question.type,
			prompt: question.prompt.trim(),
			options: question.options.map((option) => ({
				value: option.value.trim(),
				label: option.label.trim(),
			})),
			required: question.required,
		});
	}
}

function resolveIdentityName(identity: {
	name?: string | null;
	email?: string | null;
}): string | undefined {
	const preferred = identity.name?.trim() || identity.email?.trim();
	return preferred || undefined;
}

function serializeQuestion(question: Doc<"surveyQuestions">) {
	return {
		_id: question._id,
		order: question.order,
		type: question.type,
		prompt: question.prompt,
		options: question.options,
		required: question.required,
	};
}

function serializeSurvey(survey: Doc<"surveys">) {
	return {
		_id: survey._id,
		title: survey.title,
		description: survey.description,
		status: survey.status,
		deadlineAt: survey.deadlineAt,
		createdAt: survey.createdAt,
		updatedAt: survey.updatedAt,
	};
}

function buildQuestionResults(
	questions: Doc<"surveyQuestions">[],
	responses: Doc<"surveyResponses">[],
) {
	const sortedQuestions = questions.toSorted((a, b) => a.order - b.order);
	return sortedQuestions.map((question) => {
		const values = responses
			.map(
				(response) =>
					response.answers.find((answer) => answer.questionId === question._id)
						?.value,
			)
			.filter((value): value is string => typeof value === "string");

		if (question.type === "free_text") {
			return {
				question: serializeQuestion(question),
				kind: "free_text" as const,
				comments: values
					.map((value) => value.trim())
					.filter((value) => value.length > 0),
			};
		}

		const aggregates = aggregateChoiceAnswers(question.options, values);
		return {
			question: serializeQuestion(question),
			kind: "choice" as const,
			aggregates,
			pmfVeryDisappointedPercent:
				question.type === "single_choice" &&
				question.options.some((option) => option.value === "very_disappointed")
					? getPmfVeryDisappointedPercent(aggregates)
					: undefined,
		};
	});
}

export const getActiveSurveyForMe = query({
	args: {
		now: v.number(),
	},
	handler: async (ctx, { now }) => {
		const identity = await requireIdentity(ctx);

		const activeSurveys = await ctx.db
			.query("surveys")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();

		const survey =
			activeSurveys.find((candidate) => candidate.deadlineAt > now) ?? null;
		if (!survey) return null;

		const completion = await ctx.db
			.query("surveyCompletions")
			.withIndex("by_survey_user", (q) =>
				q
					.eq("surveyId", survey._id)
					.eq("userTokenIdentifier", identity.tokenIdentifier),
			)
			.first();

		if (
			!isSurveyVisibleToRespondent({
				status: survey.status,
				deadlineAt: survey.deadlineAt,
				now,
				hasCompleted: completion !== null,
			})
		) {
			return null;
		}

		const questions = await listQuestionsForSurvey(ctx, survey._id);
		return {
			survey: serializeSurvey(survey),
			questions: questions
				.toSorted((a, b) => a.order - b.order)
				.map(serializeQuestion),
		};
	},
});

export const submitSurveyResponse = mutation({
	args: {
		surveyId: v.id("surveys"),
		answers: v.array(
			v.object({
				questionId: v.id("surveyQuestions"),
				value: v.string(),
			}),
		),
		now: v.number(),
	},
	handler: async (ctx, { surveyId, answers, now }) => {
		const identity = await requireIdentity(ctx);
		const survey = await ctx.db.get(surveyId);
		if (!survey) {
			throw new Error("Survey not found");
		}

		const existingCompletion = await ctx.db
			.query("surveyCompletions")
			.withIndex("by_survey_user", (q) =>
				q
					.eq("surveyId", surveyId)
					.eq("userTokenIdentifier", identity.tokenIdentifier),
			)
			.first();

		const eligibility = canSubmitSurveyResponse({
			status: survey.status,
			deadlineAt: survey.deadlineAt,
			now,
			hasCompleted: existingCompletion !== null,
		});
		if (!eligibility.ok) {
			throw new Error(eligibility.reason);
		}

		const questions = await listQuestionsForSurvey(ctx, surveyId);
		const validation = validateSurveyAnswers(
			questions.map((question) => ({
				id: question._id,
				type: question.type,
				options: question.options,
				required: question.required,
			})),
			answers.map((answer) => ({
				questionId: answer.questionId,
				value: answer.value,
			})),
		);
		if (!validation.ok) {
			throw new Error(validation.reason);
		}

		const createdAt = Date.now();
		// Claim completion first so concurrent submits can detect races.
		const completionId = await ctx.db.insert("surveyCompletions", {
			surveyId,
			userTokenIdentifier: identity.tokenIdentifier,
			email: identity.email ?? undefined,
			name: resolveIdentityName(identity),
			createdAt,
		});

		const completionsForUser = await ctx.db
			.query("surveyCompletions")
			.withIndex("by_survey_user", (q) =>
				q
					.eq("surveyId", surveyId)
					.eq("userTokenIdentifier", identity.tokenIdentifier),
			)
			.collect();
		const winnerId = pickWinningCompletionId(completionsForUser);
		if (winnerId !== completionId) {
			await ctx.db.delete(completionId);
			throw new Error("Survey already completed");
		}
		for (const completion of completionsForUser) {
			if (completion._id !== completionId) {
				await ctx.db.delete(completion._id);
			}
		}

		await ctx.db.insert("surveyResponses", {
			surveyId,
			answers: validation.normalized.map((answer) => ({
				questionId: answer.questionId as Id<"surveyQuestions">,
				value: answer.value,
			})),
			createdAt,
		});

		return { success: true as const };
	},
});

export const listSurveys = query({
	args: {},
	handler: async (ctx) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const surveys = await ctx.db.query("surveys").order("desc").collect();
		const withCounts = await Promise.all(
			surveys.map(async (survey) => {
				const completions = await ctx.db
					.query("surveyCompletions")
					.withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
					.collect();
				return {
					...serializeSurvey(survey),
					responseCount: completions.length,
				};
			}),
		);

		return withCounts;
	},
});

export const getSurvey = query({
	args: {
		surveyId: v.id("surveys"),
	},
	handler: async (ctx, { surveyId }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const survey = await ctx.db.get(surveyId);
		if (!survey) return null;

		const questions = await listQuestionsForSurvey(ctx, surveyId);
		return {
			survey: serializeSurvey(survey),
			questions: questions
				.toSorted((a, b) => a.order - b.order)
				.map(serializeQuestion),
		};
	},
});

export const getSurveyResults = query({
	args: {
		surveyId: v.id("surveys"),
	},
	handler: async (ctx, { surveyId }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const survey = await ctx.db.get(surveyId);
		if (!survey) return null;

		const [questions, responses, completions] = await Promise.all([
			listQuestionsForSurvey(ctx, surveyId),
			ctx.db
				.query("surveyResponses")
				.withIndex("by_survey", (q) => q.eq("surveyId", surveyId))
				.collect(),
			ctx.db
				.query("surveyCompletions")
				.withIndex("by_survey", (q) => q.eq("surveyId", surveyId))
				.collect(),
		]);

		return {
			survey: serializeSurvey(survey),
			responseCount: responses.length,
			questionResults: buildQuestionResults(questions, responses),
			roster: completions
				.toSorted((a, b) => a.createdAt - b.createdAt)
				.map((completion) => ({
					email: completion.email,
					name: completion.name,
					createdAt: completion.createdAt,
				})),
		};
	},
});

/** Public summary: aggregates + anonymous comments only. Drafts stay private. */
export const getPublicSurveyResults = query({
	args: {
		surveyId: v.id("surveys"),
	},
	handler: async (ctx, { surveyId }) => {
		const survey = await ctx.db.get(surveyId);
		if (!survey || survey.status === "draft") {
			return null;
		}

		const [questions, responses] = await Promise.all([
			listQuestionsForSurvey(ctx, surveyId),
			ctx.db
				.query("surveyResponses")
				.withIndex("by_survey", (q) => q.eq("surveyId", surveyId))
				.collect(),
		]);

		return {
			survey: serializeSurvey(survey),
			responseCount: responses.length,
			questionResults: buildQuestionResults(questions, responses),
		};
	},
});

export const createSurvey = mutation({
	args: {
		title: v.string(),
		description: v.optional(v.string()),
		deadlineAt: v.number(),
		usePmfTemplate: v.optional(v.boolean()),
	},
	handler: async (ctx, { title, description, deadlineAt, usePmfTemplate }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		if (!Number.isFinite(deadlineAt)) {
			throw new Error("Invalid deadline");
		}

		const now = Date.now();
		const surveyId = await ctx.db.insert("surveys", {
			title: normalizeText(title, { min: 1, max: 200, field: "title" }),
			description: normalizeOptionalText(description, {
				max: 1000,
				field: "description",
			}),
			status: "draft",
			deadlineAt,
			createdByTokenIdentifier: identity.tokenIdentifier,
			createdAt: now,
			updatedAt: now,
		});

		if (usePmfTemplate) {
			await replaceSurveyQuestions(ctx, surveyId, getPmfTemplateQuestions());
		}

		return surveyId;
	},
});

export const updateSurvey = mutation({
	args: {
		surveyId: v.id("surveys"),
		title: v.string(),
		description: v.optional(v.string()),
		deadlineAt: v.number(),
	},
	handler: async (ctx, { surveyId, title, description, deadlineAt }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const survey = await ctx.db.get(surveyId);
		if (!survey) {
			throw new Error("Survey not found");
		}
		if (survey.status !== "draft") {
			throw new Error("Only draft surveys can be edited");
		}
		if (!Number.isFinite(deadlineAt)) {
			throw new Error("Invalid deadline");
		}

		await ctx.db.patch(surveyId, {
			title: normalizeText(title, { min: 1, max: 200, field: "title" }),
			description: normalizeOptionalText(description, {
				max: 1000,
				field: "description",
			}),
			deadlineAt,
			updatedAt: Date.now(),
		});

		return { success: true as const };
	},
});

export const setSurveyQuestions = mutation({
	args: {
		surveyId: v.id("surveys"),
		questions: v.array(questionInputValidator),
	},
	handler: async (ctx, { surveyId, questions }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const survey = await ctx.db.get(surveyId);
		if (!survey) {
			throw new Error("Survey not found");
		}
		if (survey.status !== "draft") {
			throw new Error("Only draft surveys can change questions");
		}

		await replaceSurveyQuestions(ctx, surveyId, questions);
		await ctx.db.patch(surveyId, { updatedAt: Date.now() });

		return { success: true as const };
	},
});

export const activateSurvey = mutation({
	args: {
		surveyId: v.id("surveys"),
	},
	handler: async (ctx, { surveyId }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const survey = await ctx.db.get(surveyId);
		if (!survey) {
			throw new Error("Survey not found");
		}
		if (survey.status !== "draft") {
			throw new Error("Only draft surveys can be activated");
		}

		const questions = await listQuestionsForSurvey(ctx, surveyId);
		if (questions.length === 0) {
			throw new Error("Add at least one question before activating");
		}

		const now = Date.now();
		const activeSurveys = await ctx.db
			.query("surveys")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();
		const { blocking, expiredToClose } = partitionActiveSurveysForActivation(
			activeSurveys,
			{ surveyId, now },
		);
		for (const expired of expiredToClose) {
			await ctx.db.patch(expired._id, {
				status: "closed",
				updatedAt: now,
			});
		}
		if (blocking) {
			throw new Error("Another survey is already active");
		}

		await ctx.db.patch(surveyId, {
			status: "active",
			updatedAt: now,
		});

		return { success: true as const };
	},
});

export const closeSurvey = mutation({
	args: {
		surveyId: v.id("surveys"),
	},
	handler: async (ctx, { surveyId }) => {
		const identity = await requireIdentity(ctx);
		assertAdmin(identity.email);

		const survey = await ctx.db.get(surveyId);
		if (!survey) {
			throw new Error("Survey not found");
		}
		if (survey.status === "closed") {
			return { success: true as const };
		}
		if (survey.status === "draft") {
			throw new Error(
				"Draft surveys cannot be closed; delete or leave as draft",
			);
		}

		await ctx.db.patch(surveyId, {
			status: "closed",
			updatedAt: Date.now(),
		});

		return { success: true as const };
	},
});

export const isSurveyAdmin = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return { isAuthenticated: false, isAdmin: false };
		}
		return {
			isAuthenticated: true,
			isAdmin: isAdminEmail(identity.email),
		};
	},
});
