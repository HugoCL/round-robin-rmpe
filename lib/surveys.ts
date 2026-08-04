export type SurveyStatus = "draft" | "active" | "closed";

export type SurveyQuestionType = "single_choice" | "likert" | "free_text";

export type SurveyOption = {
	value: string;
	labelEn: string;
	labelEs: string;
};

export type SurveyQuestionInput = {
	order: number;
	type: SurveyQuestionType;
	promptEn: string;
	promptEs: string;
	options: SurveyOption[];
	required: boolean;
};

export type SurveyQuestionForValidation = {
	id: string;
	type: SurveyQuestionType;
	options: SurveyOption[];
	required: boolean;
};

export type SurveyAnswerInput = {
	questionId: string;
	value: string;
};

export function isSurveyVisibleToRespondent({
	status,
	deadlineAt,
	now,
	hasCompleted,
}: {
	status: SurveyStatus;
	deadlineAt: number;
	now: number;
	hasCompleted: boolean;
}): boolean {
	return status === "active" && deadlineAt > now && !hasCompleted;
}

export function canSubmitSurveyResponse({
	status,
	deadlineAt,
	now,
	hasCompleted,
}: {
	status: SurveyStatus;
	deadlineAt: number;
	now: number;
	hasCompleted: boolean;
}): { ok: true } | { ok: false; reason: string } {
	if (status !== "active") {
		return { ok: false, reason: "Survey is not active" };
	}
	if (deadlineAt <= now) {
		return { ok: false, reason: "Survey deadline has passed" };
	}
	if (hasCompleted) {
		return { ok: false, reason: "Survey already completed" };
	}
	return { ok: true };
}

/** Split other active surveys into expired (safe to auto-close) vs still blocking. */
export function partitionActiveSurveysForActivation<
	T extends { _id: string; deadlineAt: number },
>(
	activeSurveys: T[],
	{ surveyId, now }: { surveyId: string; now: number },
): { blocking: T | null; expiredToClose: T[] } {
	const expiredToClose: T[] = [];
	let blocking: T | null = null;
	for (const survey of activeSurveys) {
		if (survey._id === surveyId) continue;
		if (survey.deadlineAt <= now) {
			expiredToClose.push(survey);
			continue;
		}
		if (!blocking) {
			blocking = survey;
		}
	}
	return { blocking, expiredToClose };
}

/** Keep the oldest completion when concurrent inserts race; losers should abort. */
export function pickWinningCompletionId<
	T extends { _id: string; _creationTime: number },
>(completions: T[]): string | null {
	if (completions.length === 0) return null;
	let winner = completions[0]!;
	for (let i = 1; i < completions.length; i++) {
		const candidate = completions[i]!;
		if (candidate._creationTime < winner._creationTime) {
			winner = candidate;
		}
	}
	return winner._id;
}

export function validateSurveyAnswers(
	questions: SurveyQuestionForValidation[],
	answers: SurveyAnswerInput[],
):
	| { ok: true; normalized: SurveyAnswerInput[] }
	| { ok: false; reason: string } {
	const answersByQuestion = new Map<string, string>();
	for (const answer of answers) {
		const trimmed = answer.value.trim();
		if (answersByQuestion.has(answer.questionId)) {
			return { ok: false, reason: "Duplicate answer for a question" };
		}
		answersByQuestion.set(answer.questionId, trimmed);
	}

	const normalized: SurveyAnswerInput[] = [];

	for (const question of questions) {
		const value = answersByQuestion.get(question.id) ?? "";
		answersByQuestion.delete(question.id);

		if (!value) {
			if (question.required) {
				return { ok: false, reason: "Required question is missing an answer" };
			}
			continue;
		}

		if (question.type === "free_text") {
			if (value.length > 2000) {
				return { ok: false, reason: "Comment is too long" };
			}
			normalized.push({ questionId: question.id, value });
			continue;
		}

		const allowed = new Set(question.options.map((option) => option.value));
		if (!allowed.has(value)) {
			return { ok: false, reason: "Invalid option for question" };
		}
		normalized.push({ questionId: question.id, value });
	}

	if (answersByQuestion.size > 0) {
		return { ok: false, reason: "Answer references unknown question" };
	}

	return { ok: true, normalized };
}

export type ChoiceAggregate = {
	value: string;
	labelEn: string;
	labelEs: string;
	count: number;
	percent: number;
};

export function aggregateChoiceAnswers(
	options: SurveyOption[],
	values: string[],
): ChoiceAggregate[] {
	const counts = new Map<string, number>();
	for (const option of options) {
		counts.set(option.value, 0);
	}
	let total = 0;
	for (const value of values) {
		if (!counts.has(value)) continue;
		counts.set(value, (counts.get(value) ?? 0) + 1);
		total += 1;
	}

	return options.map((option) => {
		const count = counts.get(option.value) ?? 0;
		return {
			value: option.value,
			labelEn: option.labelEn,
			labelEs: option.labelEs,
			count,
			percent: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
		};
	});
}

export function getPmfVeryDisappointedPercent(
	aggregates: ChoiceAggregate[],
): number {
	const match = aggregates.find((row) => row.value === "very_disappointed");
	return match?.percent ?? 0;
}

const LIKERT_OPTIONS: SurveyOption[] = [
	{
		value: "1",
		labelEn: "1 — Strongly disagree",
		labelEs: "1 — Muy en desacuerdo",
	},
	{ value: "2", labelEn: "2 — Disagree", labelEs: "2 — En desacuerdo" },
	{ value: "3", labelEn: "3 — Neutral", labelEs: "3 — Neutral" },
	{ value: "4", labelEn: "4 — Agree", labelEs: "4 — De acuerdo" },
	{ value: "5", labelEn: "5 — Strongly agree", labelEs: "5 — Muy de acuerdo" },
];

export function getPmfTemplateQuestions(): SurveyQuestionInput[] {
	return [
		{
			order: 0,
			type: "single_choice",
			promptEn: "How would you feel if you could no longer use La Lista?",
			promptEs: "¿Cómo te sentirías si ya no pudieras usar La Lista?",
			options: [
				{
					value: "very_disappointed",
					labelEn: "Very disappointed",
					labelEs: "Muy decepcionado/a",
				},
				{
					value: "somewhat_disappointed",
					labelEn: "Somewhat disappointed",
					labelEs: "Algo decepcionado/a",
				},
				{
					value: "not_disappointed",
					labelEn: "Not disappointed",
					labelEs: "No me decepcionaría",
				},
			],
			required: true,
		},
		{
			order: 1,
			type: "likert",
			promptEn: "La Lista helps me be more productive in the review process.",
			promptEs:
				"La Lista me ayuda a ser más productivo/a en el proceso de review.",
			options: LIKERT_OPTIONS,
			required: true,
		},
		{
			order: 2,
			type: "likert",
			promptEn: "La Lista reduces the time it takes to get a PR into review.",
			promptEs: "La Lista reduce el tiempo que toma poner un PR en review.",
			options: LIKERT_OPTIONS,
			required: true,
		},
		{
			order: 3,
			type: "likert",
			promptEn: "La Lista reduces “who should review this?” friction.",
			promptEs:
				"La Lista reduce la fricción de “¿quién debería revisar esto?”.",
			options: LIKERT_OPTIONS,
			required: true,
		},
		{
			order: 4,
			type: "free_text",
			promptEn: "Anything else you’d like to share? (optional)",
			promptEs: "¿Algo más que quieras compartir? (opcional)",
			options: [],
			required: false,
		},
	];
}
