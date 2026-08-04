"use client";

import { useMutation, useQuery } from "convex/react";
import { MessageSquareHeart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";

export function SurveyBanner() {
	const t = useTranslations("survey");
	const { toast } = useToast();
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 60_000);
		return () => window.clearInterval(id);
	}, []);
	const active = useQuery(api.surveys.getActiveSurveyForMe, { now });
	const submit = useMutation(api.surveys.submitSurveyResponse);

	const [open, setOpen] = useState(false);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (active === undefined || active === null) {
		return null;
	}

	const { survey, questions } = active;
	const title = survey.title || t("bannerTitle");
	const description = survey.description || t("bannerDescription");

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
			setOpen(false);
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
		<>
			<Alert className="grid-cols-[auto_minmax(0,1fr)] border-sky-500/35 bg-sky-500/5 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-50 *:data-[slot=alert-title]:col-start-auto [&>svg]:row-span-1">
				<MessageSquareHeart className="h-4 w-4 text-sky-600 dark:text-sky-400" />
				<div className="col-start-2 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
					<div className="min-w-0 space-y-1">
						<AlertTitle>{title}</AlertTitle>
						<AlertDescription className="text-sky-950/90 dark:text-sky-50/90">
							{description}
						</AlertDescription>
					</div>
					<Button
						type="button"
						size="sm"
						onClick={() => setOpen(true)}
						className="w-full shrink-0 sm:w-auto"
					>
						{t("openSurvey")}
					</Button>
				</div>
			</Alert>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
					<DialogHeader className="space-y-2 border-b border-border/60 px-6 py-5 pr-12 text-left">
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription className="space-y-2">
							<span className="block">{description}</span>
							<span className="block text-xs">{t("privacyNote")}</span>
						</DialogDescription>
					</DialogHeader>

					<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
						{questions.map((question) => {
							const fieldId = `survey-q-${question._id}`;
							return (
								<div key={question._id} className="space-y-2">
									<div className="flex flex-wrap items-baseline gap-2">
										<Label htmlFor={fieldId} className="text-sm font-medium">
											{question.prompt}
										</Label>
										<span className="text-xs text-muted-foreground">
											{question.required
												? t("requiredMark")
												: t("optionalMark")}
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
										/>
									) : (
										<RadioGroup
											value={answers[question._id] ?? ""}
											onValueChange={(value) => setAnswer(question._id, value)}
											className="gap-2"
										>
											{question.options.map((option) => {
												const optionId = `${fieldId}-${option.value}`;
												return (
													<div
														key={option.value}
														className="flex items-center gap-2"
													>
														<RadioGroupItem
															value={option.value}
															id={optionId}
														/>
														<Label
															htmlFor={optionId}
															className="font-normal text-sm"
														>
															{option.label}
														</Label>
													</div>
												);
											})}
										</RadioGroup>
									)}
								</div>
							);
						})}

						{error ? (
							<p className="text-sm text-destructive" role="alert">
								{error}
							</p>
						) : null}
					</div>

					<DialogFooter className="border-t border-border/60 px-6 py-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
							disabled={submitting}
						>
							{t("closeSurvey")}
						</Button>
						<Button
							type="button"
							disabled={submitting}
							onClick={() => void onSubmit()}
						>
							{submitting ? t("submitting") : t("submit")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
