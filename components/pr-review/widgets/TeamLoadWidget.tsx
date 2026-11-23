"use client";

import { useTranslations } from "next-intl";
import { usePRReview } from "../PRReviewContext";
import { WidgetEmpty } from "./parts";
import { WidgetFrame } from "./WidgetFrame";

/** How the PRs have spread across the team since the counts were last reset. */
export function TeamLoadWidget() {
	const t = useTranslations();
	const { reviewers } = usePRReview();
	const ranked = [...reviewers].sort(
		(a, b) =>
			b.assignmentCount - a.assignmentCount || a.createdAt - b.createdAt,
	);
	const max = Math.max(
		1,
		...ranked.map((reviewer) => reviewer.assignmentCount),
	);

	return (
		<WidgetFrame meta={t("widgets.teamLoad.since")}>
			{ranked.length === 0 ? (
				<WidgetEmpty>{t("reviewersPanel.emptyDescription")}</WidgetEmpty>
			) : (
				<ul className="grid grid-cols-[minmax(0,auto)_minmax(4rem,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
					{ranked.map((reviewer) => (
						<li
							key={reviewer._id}
							className="col-span-full grid grid-cols-subgrid items-center"
							title={t("widgets.rotation.countHint", {
								count: reviewer.assignmentCount,
							})}
						>
							<span className="max-w-40 truncate">{reviewer.name}</span>
							<span
								aria-hidden="true"
								className="h-1.5 overflow-hidden rounded-full bg-muted"
							>
								<span
									className="block h-full rounded-full bg-primary/60"
									style={{
										width: `${(reviewer.assignmentCount / max) * 100}%`,
									}}
								/>
							</span>
							<span className="text-right text-xs text-muted-foreground tabular-nums">
								{reviewer.assignmentCount}
							</span>
						</li>
					))}
				</ul>
			)}
		</WidgetFrame>
	);
}
