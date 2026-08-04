import assert from "node:assert/strict";
import test from "node:test";
import {
	aggregateChoiceAnswers,
	canSubmitSurveyResponse,
	getPmfTemplateQuestions,
	getPmfVeryDisappointedPercent,
	isSurveyVisibleToRespondent,
	normalizeSurveyOption,
	partitionActiveSurveysForActivation,
	pickWinningCompletionId,
	validateSurveyAnswers,
} from "../../lib/surveys";

test("isSurveyVisibleToRespondent requires active, open deadline, and incomplete", () => {
	assert.equal(
		isSurveyVisibleToRespondent({
			status: "active",
			deadlineAt: 200,
			now: 100,
			hasCompleted: false,
		}),
		true,
	);
	assert.equal(
		isSurveyVisibleToRespondent({
			status: "draft",
			deadlineAt: 200,
			now: 100,
			hasCompleted: false,
		}),
		false,
	);
	assert.equal(
		isSurveyVisibleToRespondent({
			status: "active",
			deadlineAt: 100,
			now: 100,
			hasCompleted: false,
		}),
		false,
	);
	assert.equal(
		isSurveyVisibleToRespondent({
			status: "active",
			deadlineAt: 200,
			now: 100,
			hasCompleted: true,
		}),
		false,
	);
});

test("canSubmitSurveyResponse returns specific failure reasons", () => {
	assert.deepEqual(
		canSubmitSurveyResponse({
			status: "closed",
			deadlineAt: 200,
			now: 100,
			hasCompleted: false,
		}),
		{ ok: false, reason: "Survey is not active" },
	);
	assert.deepEqual(
		canSubmitSurveyResponse({
			status: "active",
			deadlineAt: 50,
			now: 100,
			hasCompleted: false,
		}),
		{ ok: false, reason: "Survey deadline has passed" },
	);
	assert.deepEqual(
		canSubmitSurveyResponse({
			status: "active",
			deadlineAt: 200,
			now: 100,
			hasCompleted: true,
		}),
		{ ok: false, reason: "Survey already completed" },
	);
	assert.deepEqual(
		canSubmitSurveyResponse({
			status: "active",
			deadlineAt: 200,
			now: 100,
			hasCompleted: false,
		}),
		{ ok: true },
	);
});

test("validateSurveyAnswers enforces required options and skips empty optional free text", () => {
	const questions = [
		{
			id: "q1",
			type: "single_choice" as const,
			required: true,
			options: [
				{ value: "very_disappointed", label: "Muy" },
				{ value: "not_disappointed", label: "No" },
			],
		},
		{
			id: "q2",
			type: "free_text" as const,
			required: false,
			options: [],
		},
	];

	const missing = validateSurveyAnswers(questions, []);
	assert.equal(missing.ok, false);

	const invalid = validateSurveyAnswers(questions, [
		{ questionId: "q1", value: "nope" },
	]);
	assert.equal(invalid.ok, false);

	const ok = validateSurveyAnswers(questions, [
		{ questionId: "q1", value: "very_disappointed" },
		{ questionId: "q2", value: "   " },
	]);
	assert.equal(ok.ok, true);
	if (ok.ok) {
		assert.deepEqual(ok.normalized, [
			{ questionId: "q1", value: "very_disappointed" },
		]);
	}
});

test("aggregateChoiceAnswers computes counts and PMF very-disappointed percent", () => {
	const options = [
		{ value: "very_disappointed", label: "Muy" },
		{ value: "somewhat_disappointed", label: "Algo" },
		{ value: "not_disappointed", label: "No" },
	];
	const aggregates = aggregateChoiceAnswers(options, [
		"very_disappointed",
		"very_disappointed",
		"somewhat_disappointed",
		"not_disappointed",
	]);
	assert.equal(aggregates[0]?.count, 2);
	assert.equal(aggregates[0]?.percent, 50);
	assert.equal(getPmfVeryDisappointedPercent(aggregates), 50);
});

test("getPmfTemplateQuestions returns the default five-question set", () => {
	const questions = getPmfTemplateQuestions();
	assert.equal(questions.length, 5);
	assert.equal(questions[0]?.type, "single_choice");
	assert.equal(questions[1]?.type, "likert");
	assert.equal(questions[4]?.required, false);
});

test("partitionActiveSurveysForActivation auto-closes expired and blocks live ones", () => {
	const result = partitionActiveSurveysForActivation(
		[
			{ _id: "current", deadlineAt: 500 },
			{ _id: "expired", deadlineAt: 50 },
			{ _id: "live", deadlineAt: 400 },
		],
		{ surveyId: "current", now: 100 },
	);
	assert.equal(result.blocking?._id, "live");
	assert.deepEqual(
		result.expiredToClose.map((survey) => survey._id),
		["expired"],
	);

	const onlyExpired = partitionActiveSurveysForActivation(
		[
			{ _id: "current", deadlineAt: 500 },
			{ _id: "expired", deadlineAt: 50 },
		],
		{ surveyId: "current", now: 100 },
	);
	assert.equal(onlyExpired.blocking, null);
	assert.equal(onlyExpired.expiredToClose.length, 1);
});

test("pickWinningCompletionId keeps the oldest completion", () => {
	assert.equal(
		pickWinningCompletionId([
			{ _id: "b", _creationTime: 20 },
			{ _id: "a", _creationTime: 10 },
			{ _id: "c", _creationTime: 30 },
		]),
		"a",
	);
	assert.equal(pickWinningCompletionId([]), null);
});

test("normalizeSurveyOption prefers Spanish labels from bilingual leftovers", () => {
	assert.deepEqual(
		normalizeSurveyOption({
			value: "very_disappointed",
			labelEn: "Very disappointed",
			labelEs: "Muy decepcionado/a",
		}),
		{ value: "very_disappointed", label: "Muy decepcionado/a" },
	);
	assert.deepEqual(
		normalizeSurveyOption({
			value: "1",
			label: "1 — Muy en desacuerdo",
		}),
		{ value: "1", label: "1 — Muy en desacuerdo" },
	);
});
