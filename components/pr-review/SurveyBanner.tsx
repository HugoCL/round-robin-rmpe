"use client";

import { useMutation, useQuery } from "convex/react";
import { MessageSquareHeart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";

export function SurveyBanner() {
	const t = useTranslations("survey");
	const locale = useLocale();
	const { toast } = useToast();
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 60_000);
		return () => window.clearInterval(id);
	}, []);
	const active = useQuery(api.surveys.getActiveSurveyForMe, { now });
	const submit = useMutation(api.surveys.submitSurveyResponse);

	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (active === undefined || active === null) {
		return null;
	}

	const { survey, questions } = active;
	const title = locale === "es" ? survey.titleEs : survey.titleEn;
	const description =
		locale === "es" ? survey.descriptionEs : survey.descriptionEn;

	const setAnswer = (questionId: string, value: string) => {
		setAnswers((prev) => ({ ...prev, [questionId]: value }));
		setError(null);
	};

	const onSubmit = async () => {
		const missingRequired = questions.some(
			(question) => question.required && !answers[question._id]?.trim().length,
		);
		if (missingRequired) {
			setError(t("validationMissing"));
			return;
		}

		setSubmitting(true);
		try {
			await submit({
				surveyId: survey._id,
				now: Date.now(),
				answers: questions
					.map((question) => ({
						questionId: question._id as Id<"surveyQuestions">,
						value: answers[question._id]?.trim() ?? "",
					}))
					.filter((answer) => answer.value.length > 0),
			});
			toast({
				title: t("messages.submittedTitle"),
				description: t("messages.submittedDescription"),
			});
		} catch {
			toast({
				title: t("messages.submitFailedTitle"),
				description: t("messages.submitFailedDescription"),
				variant: "destructive",
			});
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Alert className="border-sky-500/35 bg-sky-500/5 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-50">
			<MessageSquareHeart className="h-4 w-4 text-sky-600 dark:text-sky-400" />
			<AlertTitle>{title || t("bannerTitle")}</AlertTitle>
			<AlertDescription className="mt-2 space-y-4">
				<p className="text-sm text-sky-950/90 dark:text-sky-50/90">
					{description || t("bannerDescription")}
				</p>
				<p className="text-xs text-muted-foreground">{t("privacyNote")}</p>

				<div className="space-y-4">
					{questions.map((question) => {
						const prompt =
							locale === "es" ? question.promptEs : question.promptEn;
						const fieldId = `survey-q-${question._id}`;
						return (
							<div key={question._id} className="space-y-2">
								<div className="flex flex-wrap items-baseline gap-2">
									<Label htmlFor={fieldId} className="text-sm font-medium">
										{prompt}
									</Label>
									<span className="text-xs text-muted-foreground">
										{question.required ? t("requiredMark") : t("optionalMark")}
									</span>
								</div>

								{question.type === "free_text" ? (
									<Textarea
										id={fieldId}
										value={answers[question._id] ?? ""}
										onChange={(event) =>
											setAnswer(question._id, event.target.value)
										}
										rows={3}
										maxLength={2000}
										className="bg-background/80"
									/>
								) : (
									<RadioGroup
										value={answers[question._id] ?? ""}
										onValueChange={(value) => setAnswer(question._id, value)}
										className="gap-2"
									>
										{question.options.map((option) => {
											const optionId = `${fieldId}-${option.value}`;
											const label =
												locale === "es" ? option.labelEs : option.labelEn;
											return (
												<div
													key={option.value}
													className="flex items-center gap-2"
												>
													<RadioGroupItem value={option.value} id={optionId} />
													<Label
														htmlFor={optionId}
														className="font-normal text-sm"
													>
														{label}
													</Label>
												</div>
											);
										})}
									</RadioGroup>
								)}
							</div>
						);
					})}
				</div>

				{error ? (
					<p className="text-sm text-destructive" role="alert">
						{error}
					</p>
				) : null}

				<Button
					type="button"
					size="sm"
					disabled={submitting}
					onClick={() => void onSubmit()}
					className="w-fit"
				>
					{submitting ? t("submitting") : t("submit")}
				</Button>
			</AlertDescription>
		</Alert>
	);
}
