"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { SurveyResultsSummary } from "@/components/surveys/SurveyResultsSummary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function PublicSurveyResultsPage({
	surveyId,
}: {
	surveyId: Id<"surveys">;
}) {
	const t = useTranslations("survey");
	const results = useQuery(api.surveys.getPublicSurveyResults, { surveyId });

	if (results === undefined) {
		return (
			<main className="container mx-auto max-w-3xl px-4 py-10">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="mt-6 h-48 w-full" />
			</main>
		);
	}

	if (results === null) {
		return (
			<main className="container mx-auto max-w-3xl px-4 py-12">
				<h1 className="text-2xl font-semibold tracking-tight">
					{t("public.unavailableTitle")}
				</h1>
				<p className="mt-2 text-muted-foreground">
					{t("public.unavailableDescription")}
				</p>
			</main>
		);
	}

	return (
		<main className="container mx-auto max-w-3xl space-y-8 px-4 py-10 md:py-14">
			<header className="space-y-3">
				<p className="calm-kicker">La Lista</p>
				<h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
					{results.survey.title}
				</h1>
				{results.survey.description ? (
					<p className="text-muted-foreground">{results.survey.description}</p>
				) : null}
				<p className="text-sm text-muted-foreground">
					{t("public.privacyNote")}
				</p>
			</header>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold">{t("admin.resultsTitle")}</h2>
				<SurveyResultsSummary
					responseCount={results.responseCount}
					questionResults={results.questionResults}
				/>
			</section>
		</main>
	);
}
