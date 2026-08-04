"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SurveyResultsSummary } from "@/components/surveys/SurveyResultsSummary";
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
	label: string;
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
			label: "Opción A",
		},
		{
			clientKey: `opt-b-${Date.now()}`,
			value: "option_b",
			label: "Opción B",
		},
	];
}

function blankQuestion(order: number): EditableQuestion {
	return {
		clientKey: `q-${Date.now()}-${order}`,
		order,
		type: "single_choice",
		prompt: "",
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

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [deadlineLocal, setDeadlineLocal] = useState("");
	const [questions, setQuestions] = useState<EditableQuestion[]>([]);
	const [hydrated, setHydrated] = useState(false);
	const [saving, setSaving] = useState(false);
	const [activating, setActivating] = useState(false);
	const [closing, setClosing] = useState(false);

	useEffect(() => {
		if (!detail || hydrated) return;
		setTitle(detail.survey.title);
		setDescription(detail.survey.description ?? "");
		setDeadlineLocal(toDatetimeLocalValue(detail.survey.deadlineAt));
		setQuestions(
			detail.questions.map((question, index) => ({
				clientKey: question._id,
				order: index,
				type: question.type,
				prompt: question.prompt,
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
	const publicResultsPath = `/${locale}/surveys/${surveyId}/results`;

	const copyPublicLink = async () => {
		const url = `${window.location.origin}${publicResultsPath}`;
		try {
			await navigator.clipboard.writeText(url);
			toast({
				title: t("admin.messages.linkCopiedTitle"),
				description: t("admin.messages.linkCopiedDescription"),
			});
		} catch {
			toast({
				title: t("admin.messages.linkCopyFailed"),
				variant: "destructive",
			});
		}
	};

	const persistDraft = async () => {
		await updateSurvey({
			surveyId,
			title,
			description: description || undefined,
			deadlineAt: fromDatetimeLocalValue(deadlineLocal),
		});
		await setSurveyQuestions({
			surveyId,
			questions: questions.map((question, index) => ({
				order: index,
				type: question.type,
				prompt: question.prompt,
				options:
					question.type === "free_text"
						? []
						: question.options.map(({ value, label }) => ({
								value,
								label,
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
					{!isDraft ? (
						<Button
							type="button"
							variant="outline"
							onClick={() => void copyPublicLink()}
						>
							{t("admin.copyPublicLink")}
						</Button>
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
						<div className="space-y-2 md:col-span-2">
							<Label htmlFor="title">{t("admin.surveyTitle")}</Label>
							<Input
								id="title"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<Label htmlFor="description">
								{t("admin.surveyDescription")}
							</Label>
							<Textarea
								id="description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
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
									<div className="space-y-2 md:col-span-2">
										<Label>{t("admin.prompt")}</Label>
										<Textarea
											value={question.prompt}
											onChange={(event) =>
												updateQuestion(question.clientKey, {
													prompt: event.target.value,
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
																label: "Nueva opción",
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
												className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
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
													aria-label={t("admin.optionLabel")}
													value={option.label}
													onChange={(event) => {
														const options = question.options.map((row) =>
															row.clientKey === option.clientKey
																? { ...row, label: event.target.value }
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
						{detail.survey.title}
					</h1>
					<p className="text-muted-foreground">
						{detail.survey.status} · {t("admin.deadline")}:{" "}
						{new Date(detail.survey.deadlineAt).toLocaleString(locale)}
					</p>
				</header>
			)}

			<section className="space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-xl font-semibold">{t("admin.resultsTitle")}</h2>
					{!isDraft ? (
						<Button asChild variant="ghost" size="sm">
							<Link href={publicResultsPath} target="_blank">
								{t("admin.openPublicResults")}
							</Link>
						</Button>
					) : null}
				</div>
				{results === undefined ? (
					<Skeleton className="h-40 w-full" />
				) : results === null ? (
					<p className="text-muted-foreground">{t("admin.noResultsYet")}</p>
				) : (
					<div className="space-y-6">
						<SurveyResultsSummary
							responseCount={results.responseCount}
							questionResults={results.questionResults}
						/>

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
