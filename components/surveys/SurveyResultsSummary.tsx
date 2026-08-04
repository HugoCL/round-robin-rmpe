"use client";

import { useTranslations } from "next-intl";
import type { ChoiceAggregate } from "@/lib/surveys";

type QuestionResult =
	| {
			question: {
				_id: string;
				prompt: string;
			};
			kind: "free_text";
			comments: string[];
	  }
	| {
			question: {
				_id: string;
				prompt: string;
			};
			kind: "choice";
			aggregates: ChoiceAggregate[];
			pmfVeryDisappointedPercent?: number;
	  };

export function SurveyResultsSummary({
	responseCount,
	questionResults,
}: {
	responseCount: number;
	questionResults: QuestionResult[];
}) {
	const t = useTranslations("survey");

	if (responseCount === 0) {
		return <p className="text-muted-foreground">{t("admin.noResultsYet")}</p>;
	}

	return (
		<div className="space-y-6">
			<p className="text-sm text-muted-foreground">
				{t("admin.responses", { count: responseCount })}
			</p>
			{questionResults.map((result) => (
				<div
					key={result.question._id}
					className="space-y-3 rounded-xl border border-border/70 p-4"
				>
					<h3 className="font-medium">{result.question.prompt}</h3>
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
							{result.aggregates.map((row) => (
								<div key={row.value} className="space-y-1">
									<div className="flex justify-between text-sm">
										<span>{row.label}</span>
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
							))}
						</div>
					)}
				</div>
			))}
		</div>
	);
}
