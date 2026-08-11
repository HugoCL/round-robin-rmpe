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
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
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
			<Alert
				data-notice
				className="grid-cols-[auto_minmax(0,1fr)] rounded-xl border-primary/20 bg-primary/[0.04] px-3 py-2.5 text-foreground shadow-none sm:px-4 *:data-[slot=alert-title]:col-start-auto [&>svg]:row-span-1"
			>
				<MessageSquareHeart className="text-primary" />
				<div className="col-start-2 flex min-w-0 items-center gap-3 sm:gap-4">
					<div className="min-w-0 flex-1">
						<AlertTitle>{title}</AlertTitle>
						<AlertDescription className="line-clamp-1 text-xs sm:text-sm">
							{description}
						</AlertDescription>
					</div>
					<Button
						type="button"
						size="sm"
						onClick={() => setOpen(true)}
						className="shrink-0"
					>
						{t("openSurvey")}
					</Button>
				</div>
			</Alert>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
					<DialogHeader className="gap-2 border-b border-border/60 bg-muted/20 px-5 py-5 pr-14 text-left sm:px-6">
						<DialogTitle className="text-lg font-semibold tracking-tight">
							{title}
						</DialogTitle>
						<DialogDescription className="flex flex-col gap-2">
							<span className="block">{description}</span>
							<span className="block text-xs">{t("privacyNote")}</span>
						</DialogDescription>
					</DialogHeader>

					<FieldGroup className="min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-5 sm:px-6">
						{questions.map((question) => {
							const fieldId = `survey-q-${question._id}`;
							const missing =
								Boolean(error) &&
								question.required &&
								!answers[question._id]?.trim().length;
							return (
								<Field
									key={question._id}
									data-invalid={missing}
									className="gap-2"
								>
									<div className="flex flex-wrap items-baseline gap-2">
										{question.type === "free_text" ? (
											<FieldLabel htmlFor={fieldId}>
												{question.prompt}
											</FieldLabel>
										) : (
											<span className="text-sm font-medium">
												{question.prompt}
											</span>
										)}
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
											aria-invalid={missing}
										/>
									) : (
										<FieldSet>
											<FieldLegend className="sr-only" variant="label">
												{question.prompt}
											</FieldLegend>
											<RadioGroup
												value={answers[question._id] ?? ""}
												onValueChange={(value) =>
													setAnswer(question._id, value)
												}
												className="gap-2"
												aria-invalid={missing}
											>
												{question.options.map((option) => {
													const optionId = `${fieldId}-${option.value}`;
													return (
														<Field
															key={option.value}
															orientation="horizontal"
															className="gap-2"
														>
															<RadioGroupItem
																value={option.value}
																id={optionId}
															/>
															<FieldLabel
																htmlFor={optionId}
																className="font-normal"
															>
																{option.label}
															</FieldLabel>
														</Field>
													);
												})}
											</RadioGroup>
										</FieldSet>
									)}
								</Field>
							);
						})}

						{error ? (
							<p className="text-sm text-destructive" role="alert">
								{error}
							</p>
						) : null}
					</FieldGroup>

					<DialogFooter className="border-t border-border/60 bg-muted/15 px-5 py-4 sm:px-6">
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
