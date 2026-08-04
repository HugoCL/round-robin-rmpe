"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";
import {
	getPmfTemplateQuestions,
	type SurveyQuestionInput,
	type SurveyQuestionType,
} from "@/lib/surveys";

function toDatetimeLocalValue(ms: number): string {
	const date = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): number {
	const parsed = new Date(value);
	return parsed.getTime();
}

type EditableOption = {
	clientKey: string;
	value: string;
	labelEn: string;
	labelEs: string;
};

type EditableQuestion = Omit<SurveyQuestionInput, "options"> & {
	clientKey: string;
	options: EditableOption[];
};

function blankOptions(): EditableOption[] {
	return [
		{
			clientKey: `opt-a-${Date.now()}`,
			value: "option_a",
			labelEn: "Option A",
			labelEs: "Opción A",
		},
		{
			clientKey: `opt-b-${Date.now()}`,
			value: "option_b",
			labelEn: "Option B",
			labelEs: "Opción B",
		},
	];
}

function blankQuestion(order: number): EditableQuestion {
	return {
		clientKey: `q-${Date.now()}-${order}`,
		order,
		type: "single_choice",
		promptEn: "",
		promptEs: "",
		options: blankOptions(),
		required: true,
	};
}

export function SurveyDetailPage({ surveyId }: { surveyId: Id<"surveys"> }) {
	const t = useTranslations("survey");
	const locale = useLocale();
	const { toast } = useToast();
	const access = useQuery(api.surveys.isSurveyAdmin);
	const detail = useQuery(
		api.surveys.getSurvey,
		access?.isAdmin ? { surveyId } : "skip",
	);
	const results = useQuery(
		api.surveys.getSurveyResults,
		access?.isAdmin ? { surveyId } : "skip",
	);

	const updateSurvey = useMutation(api.surveys.updateSurvey);
	const setSurveyQuestions = useMutation(api.surveys.setSurveyQuestions);
	const activateSurvey = useMutation(api.surveys.activateSurvey);
	const closeSurvey = useMutation(api.surveys.closeSurvey);

	const [titleEn, setTitleEn] = useState("");
	const [titleEs, setTitleEs] = useState("");
	const [descriptionEn, setDescriptionEn] = useState("");
	const [descriptionEs, setDescriptionEs] = useState("");
	const [deadlineLocal, setDeadlineLocal] = useState("");
	const [questions, setQuestions] = useState<EditableQuestion[]>([]);
	const [hydrated, setHydrated] = useState(false);
	const [saving, setSaving] = useState(false);
	const [activating, setActivating] = useState(false);
	const [closing, setClosing] = useState(false);

	useEffect(() => {
		if (!detail || hydrated) return;
		setTitleEn(detail.survey.titleEn);
		setTitleEs(detail.survey.titleEs);
		setDescriptionEn(detail.survey.descriptionEn ?? "");
		setDescriptionEs(detail.survey.descriptionEs ?? "");
		setDeadlineLocal(toDatetimeLocalValue(detail.survey.deadlineAt));
		setQuestions(
			detail.questions.map((question, index) => ({
				clientKey: question._id,
				order: index,
				type: question.type,
				promptEn: question.promptEn,
				promptEs: question.promptEs,
				options: question.options.map((option) => ({
					clientKey: `${question._id}-${option.value}`,
					...option,
				})),
				required: question.required,
			})),
		);
		setHydrated(true);
	}, [detail, hydrated]);

	if (access === undefined) {
		return (
			<main className="container mx-auto max-w-5xl px-4 py-8">
				<Skeleton className="h-10 w-64" />
			</main>
		);
	}

	if (!access.isAdmin) {
		return (
			<main className="container mx-auto max-w-3xl px-4 py-12">
				<h1 className="text-2xl font-semibold">
					{t("admin.unauthorizedTitle")}
				</h1>
				<p className="mt-2 text-muted-foreground">
					{t("admin.unauthorizedDescription")}
				</p>
			</main>
		);
	}

	if (detail === undefined) {
		return (
			<main className="container mx-auto max-w-5xl px-4 py-8">
				<Skeleton className="h-64 w-full" />
			</main>
		);
	}

	if (detail === null) {
		return (
			<main className="container mx-auto max-w-3xl px-4 py-12">
				<p className="text-muted-foreground">Survey not found.</p>
				<Button asChild className="mt-4" variant="outline">
					<Link href={`/${locale}/surveys`}>{t("admin.backToList")}</Link>
				</Button>
			</main>
		);
	}

	const isDraft = detail.survey.status === "draft";
	const isActive = detail.survey.status === "active";

	const persistDraft = async () => {
		await updateSurvey({
			surveyId,
			titleEn,
			titleEs,
			descriptionEn: descriptionEn || undefined,
			descriptionEs: descriptionEs || undefined,
			deadlineAt: fromDatetimeLocalValue(deadlineLocal),
		});
		await setSurveyQuestions({
			surveyId,
			questions: questions.map((question, index) => ({
				order: index,
				type: question.type,
				promptEn: question.promptEn,
				promptEs: question.promptEs,
				options:
					question.type === "free_text"
						? []
						: question.options.map(({ value, labelEn, labelEs }) => ({
								value,
								labelEn,
								labelEs,
							})),
				required: question.required,
			})),
		});
	};

	const saveDraft = async () => {
		setSaving(true);
		try {
			await persistDraft();
			toast({
				title: t("admin.messages.savedTitle"),
				description: t("admin.messages.savedDescription"),
			});
		} catch {
			toast({
				title: t("admin.messages.saveFailed"),
				variant: "destructive",
			});
		} finally {
			setSaving(false);
		}
	};

	const onActivate = async () => {
		setActivating(true);
		try {
			await persistDraft();
			await activateSurvey({ surveyId });
			toast({
				title: t("admin.messages.activatedTitle"),
				description: t("admin.messages.activatedDescription"),
			});
		} catch {
			toast({
				title: t("admin.messages.activateFailed"),
				variant: "destructive",
			});
		} finally {
			setActivating(false);
		}
	};

	const onClose = async () => {
		setClosing(true);
		try {
			await closeSurvey({ surveyId });
			toast({
				title: t("admin.messages.closedTitle"),
				description: t("admin.messages.closedDescription"),
			});
		} catch {
			toast({
				title: t("admin.messages.closeFailed"),
				variant: "destructive",
			});
		} finally {
			setClosing(false);
		}
	};

	const updateQuestion = (
		clientKey: string,
		patch: Partial<EditableQuestion>,
	) => {
		setQuestions((prev) =>
			prev.map((question) =>
				question.clientKey === clientKey ? { ...question, ...patch } : question,
			),
		);
	};

	return (
		<main className="container mx-auto max-w-5xl space-y-8 px-4 py-8 md:py-12">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Button asChild variant="ghost" size="sm">
					<Link href={`/${locale}/surveys`}>{t("admin.backToList")}</Link>
				</Button>
				<div className="flex flex-wrap gap-2">
					{isDraft ? (
						<>
							<Button
								type="button"
								variant="outline"
								disabled={saving}
								onClick={() => void saveDraft()}
							>
								{saving ? t("admin.saving") : t("admin.save")}
							</Button>
							<Button
								type="button"
								disabled={activating}
								onClick={() => void onActivate()}
							>
								{activating ? t("admin.activating") : t("admin.activate")}
							</Button>
						</>
					) : null}
					{isActive ? (
						<Button
							type="button"
							variant="destructive"
							disabled={closing}
							onClick={() => void onClose()}
						>
							{closing ? t("admin.closing") : t("admin.close")}
						</Button>
					) : null}
				</div>
			</div>

			{isDraft ? (
				<section className="space-y-6">
					<h1 className="text-2xl font-semibold tracking-tight">
						{t("admin.editTitle")}
					</h1>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="titleEn">{t("admin.titleEn")}</Label>
							<Input
								id="titleEn"
								value={titleEn}
								onChange={(event) => setTitleEn(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="titleEs">{t("admin.titleEs")}</Label>
							<Input
								id="titleEs"
								value={titleEs}
								onChange={(event) => setTitleEs(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="descriptionEn">{t("admin.descriptionEn")}</Label>
							<Textarea
								id="descriptionEn"
								value={descriptionEn}
								onChange={(event) => setDescriptionEn(event.target.value)}
								rows={3}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="descriptionEs">{t("admin.descriptionEs")}</Label>
							<Textarea
								id="descriptionEs"
								value={descriptionEs}
								onChange={(event) => setDescriptionEs(event.target.value)}
								rows={3}
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<Label htmlFor="deadline">{t("admin.deadline")}</Label>
							<Input
								id="deadline"
								type="datetime-local"
								value={deadlineLocal}
								onChange={(event) => setDeadlineLocal(event.target.value)}
							/>
						</div>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-lg font-semibold">{t("admin.questions")}</h2>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() =>
									setQuestions(
										getPmfTemplateQuestions().map((question, index) => ({
											...question,
											clientKey: `pmf-${index}-${Date.now()}`,
											options: question.options.map((option) => ({
												clientKey: `pmf-${index}-${option.value}`,
												...option,
											})),
										})),
									)
								}
							>
								{t("admin.loadPmfTemplate")}
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={() =>
									setQuestions((prev) => [...prev, blankQuestion(prev.length)])
								}
							>
								{t("admin.addQuestion")}
							</Button>
						</div>
					</div>

					<div className="space-y-4">
						{questions.map((question, index) => (
							<div
								key={question.clientKey}
								className="space-y-3 rounded-xl border border-border/70 p-4"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className="text-sm font-medium">#{index + 1}</p>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											size="sm"
											variant="ghost"
											disabled={index === 0}
											onClick={() =>
												setQuestions((prev) => {
													const next = [...prev];
													const current = next[index];
													const previous = next[index - 1];
													if (!current || !previous) return prev;
													next[index - 1] = current;
													next[index] = previous;
													return next;
												})
											}
										>
											{t("admin.moveUp")}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											disabled={index === questions.length - 1}
											onClick={() =>
												setQuestions((prev) => {
													const next = [...prev];
													const current = next[index];
													const following = next[index + 1];
													if (!current || !following) return prev;
													next[index + 1] = current;
													next[index] = following;
													return next;
												})
											}
										>
											{t("admin.moveDown")}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											onClick={() =>
												setQuestions((prev) =>
													prev.filter(
														(row) => row.clientKey !== question.clientKey,
													),
												)
											}
										>
											{t("admin.removeQuestion")}
										</Button>
									</div>
								</div>

								<div className="grid gap-3 md:grid-cols-2">
									<div className="space-y-2">
										<Label>{t("admin.questionType")}</Label>
										<Select
											value={question.type}
											onValueChange={(value) =>
												updateQuestion(question.clientKey, {
													type: value as SurveyQuestionType,
													options:
														value === "free_text"
															? []
															: question.options.length >= 2
																? question.options
																: blankOptions(),
												})
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="single_choice">
													{t("admin.typeSingleChoice")}
												</SelectItem>
												<SelectItem value="likert">
													{t("admin.typeLikert")}
												</SelectItem>
												<SelectItem value="free_text">
													{t("admin.typeFreeText")}
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
										<Label htmlFor={`required-${question.clientKey}`}>
											{t("admin.required")}
										</Label>
										<Switch
											id={`required-${question.clientKey}`}
											checked={question.required}
											onCheckedChange={(checked) =>
												updateQuestion(question.clientKey, {
													required: checked,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>{t("admin.promptEn")}</Label>
										<Textarea
											value={question.promptEn}
											onChange={(event) =>
												updateQuestion(question.clientKey, {
													promptEn: event.target.value,
												})
											}
											rows={2}
										/>
									</div>
									<div className="space-y-2">
										<Label>{t("admin.promptEs")}</Label>
										<Textarea
											value={question.promptEs}
											onChange={(event) =>
												updateQuestion(question.clientKey, {
													promptEs: event.target.value,
												})
											}
											rows={2}
										/>
									</div>
								</div>

								{question.type !== "free_text" ? (
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label>{t("admin.options")}</Label>
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() =>
													updateQuestion(question.clientKey, {
														options: [
															...question.options,
															{
																clientKey: `opt-${Date.now()}`,
																value: `option_${question.options.length + 1}`,
																labelEn: "New option",
																labelEs: "Nueva opción",
															},
														],
													})
												}
											>
												{t("admin.addOption")}
											</Button>
										</div>
										{question.options.map((option) => (
											<div
												key={option.clientKey}
												className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
											>
												<Input
													aria-label={t("admin.optionValue")}
													value={option.value}
													onChange={(event) => {
														const options = question.options.map((row) =>
															row.clientKey === option.clientKey
																? { ...row, value: event.target.value }
																: row,
														);
														updateQuestion(question.clientKey, { options });
													}}
												/>
												<Input
													aria-label={t("admin.optionLabelEn")}
													value={option.labelEn}
													onChange={(event) => {
														const options = question.options.map((row) =>
															row.clientKey === option.clientKey
																? { ...row, labelEn: event.target.value }
																: row,
														);
														updateQuestion(question.clientKey, { options });
													}}
												/>
												<Input
													aria-label={t("admin.optionLabelEs")}
													value={option.labelEs}
													onChange={(event) => {
														const options = question.options.map((row) =>
															row.clientKey === option.clientKey
																? { ...row, labelEs: event.target.value }
																: row,
														);
														updateQuestion(question.clientKey, { options });
													}}
												/>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													onClick={() =>
														updateQuestion(question.clientKey, {
															options: question.options.filter(
																(row) => row.clientKey !== option.clientKey,
															),
														})
													}
												>
													{t("admin.removeOption")}
												</Button>
											</div>
										))}
									</div>
								) : null}
							</div>
						))}
					</div>
				</section>
			) : (
				<header className="space-y-2">
					<h1 className="text-2xl font-semibold tracking-tight">
						{locale === "es" ? detail.survey.titleEs : detail.survey.titleEn}
					</h1>
					<p className="text-muted-foreground">
						{detail.survey.status} · {t("admin.deadline")}:{" "}
						{new Date(detail.survey.deadlineAt).toLocaleString(locale)}
					</p>
				</header>
			)}

			<section className="space-y-4">
				<h2 className="text-xl font-semibold">{t("admin.resultsTitle")}</h2>
				{results === undefined ? (
					<Skeleton className="h-40 w-full" />
				) : results === null || results.responseCount === 0 ? (
					<p className="text-muted-foreground">{t("admin.noResultsYet")}</p>
				) : (
					<div className="space-y-6">
						<p className="text-sm text-muted-foreground">
							{t("admin.responses", { count: results.responseCount })}
						</p>
						{results.questionResults.map((result) => {
							const prompt =
								locale === "es"
									? result.question.promptEs
									: result.question.promptEn;
							return (
								<div
									key={result.question._id}
									className="space-y-3 rounded-xl border border-border/70 p-4"
								>
									<h3 className="font-medium">{prompt}</h3>
									{result.kind === "free_text" ? (
										result.comments.length === 0 ? (
											<p className="text-sm text-muted-foreground">
												{t("admin.commentsEmpty")}
											</p>
										) : (
											<ul className="space-y-2">
												{(() => {
													const seen = new Map<string, number>();
													return result.comments.map((comment) => {
														const occurrence = (seen.get(comment) ?? 0) + 1;
														seen.set(comment, occurrence);
														return (
															<li
																key={`${result.question._id}:${occurrence}:${comment}`}
																className="rounded-lg bg-muted/40 px-3 py-2 text-sm"
															>
																{comment}
															</li>
														);
													});
												})()}
											</ul>
										)
									) : (
										<div className="space-y-2">
											{typeof result.pmfVeryDisappointedPercent === "number" ? (
												<p className="text-sm font-medium text-primary">
													{t("admin.pmfHighlight", {
														percent: result.pmfVeryDisappointedPercent,
													})}
												</p>
											) : null}
											{result.aggregates.map((row) => {
												const label =
													locale === "es" ? row.labelEs : row.labelEn;
												return (
													<div key={row.value} className="space-y-1">
														<div className="flex justify-between text-sm">
															<span>{label}</span>
															<span className="text-muted-foreground">
																{t("admin.choiceCount", {
																	count: row.count,
																	percent: row.percent,
																})}
															</span>
														</div>
														<div className="h-2 overflow-hidden rounded-full bg-muted">
															<div
																className="h-full bg-primary/80"
																style={{ width: `${row.percent}%` }}
															/>
														</div>
													</div>
												);
											})}
										</div>
									)}
								</div>
							);
						})}

						<div className="space-y-2 rounded-xl border border-border/70 p-4">
							<h3 className="font-medium">{t("admin.rosterTitle")}</h3>
							{results.roster.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									{t("admin.rosterEmpty")}
								</p>
							) : (
								<ul className="space-y-1 text-sm">
									{results.roster.map((row) => (
										<li key={`${row.email ?? row.name}-${row.createdAt}`}>
											{row.name || row.email || t("admin.rosterAnonymous")}
											{row.email && row.name ? ` · ${row.email}` : null}
											<span className="text-muted-foreground">
												{" "}
												· {new Date(row.createdAt).toLocaleString(locale)}
											</span>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				)}
			</section>
		</main>
	);
}
