"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { toast } from "@/hooks/use-toast";
import { useMyAssignments } from "@/hooks/useMyAssignments";
import { parsePrUrl } from "@/lib/prUrl";
import { WidgetEmpty, WidgetMore, widgetRowClass } from "./parts";
import { useWidgetSize, WidgetFrame } from "./WidgetFrame";

const HOUR_MS = 60 * 60 * 1000;

/** Small shows the newest few, one line each. */
const SMALL_COUNT = 3;

function ago(timestamp: number, now: number, locale: string) {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	const hours = Math.round((timestamp - now) / HOUR_MS);
	return Math.abs(hours) < 24
		? format.format(hours, "hour")
		: format.format(Math.round(hours / 24), "day");
}

/** The PRs assigned to you that you have not ticked off yet. */
export function MyReviewsWidget() {
	const t = useTranslations();
	const locale = useLocale();
	const { assignedToMe, complete, loading } = useMyAssignments();
	const [now] = useState(() => Date.now());
	const small = useWidgetSize() === "small";
	const pending = [...assignedToMe].sort((a, b) => b.createdAt - a.createdAt);
	const shown = small ? pending.slice(0, SMALL_COUNT) : pending;

	return (
		<WidgetFrame meta={pending.length > 0 ? pending.length : undefined}>
			{loading ? null : pending.length === 0 ? (
				<WidgetEmpty>{t("widgets.myReviews.empty")}</WidgetEmpty>
			) : (
				<>
					<ul>
						{shown.map((assignment) => {
							const parsed = assignment.prUrl
								? parsePrUrl(assignment.prUrl)
								: null;
							const label = parsed
								? `${parsed.repo} #${parsed.number}`
								: t("history.entryNoPr");
							return (
								<li key={assignment._id} className={widgetRowClass}>
									<span className="min-w-0 flex-1">
										{assignment.prUrl && parsed ? (
											<a
												href={assignment.prUrl}
												target="_blank"
												rel="noreferrer noopener"
												className="block truncate font-mono text-xs text-foreground underline-offset-4 hover:underline"
											>
												{label}
											</a>
										) : (
											<span className="block truncate">{label}</span>
										)}
										{small ? null : (
											<span className="block truncate text-xs text-muted-foreground">
												{assignment.assignerName
													? t("widgets.myReviews.from", {
															name: assignment.assignerName,
															when: ago(assignment.createdAt, now, locale),
														})
													: ago(assignment.createdAt, now, locale)}
											</span>
										)}
									</span>
									{assignment.urgent ? (
										<Badge
											variant="destructive"
											className="text-red-700 dark:text-red-300"
										>
											{t("pr.urgent")}
										</Badge>
									) : null}
									<IconActionButton
										label={t("widgets.myReviews.markDone", { pr: label })}
										onClick={() =>
											void complete({ id: assignment._id }).catch(() =>
												toast({
													title: t("common.error"),
													description: t("widgets.myReviews.markDoneFailed"),
													variant: "destructive",
												}),
											)
										}
									>
										<Check />
									</IconActionButton>
								</li>
							);
						})}
					</ul>
					<WidgetMore count={pending.length - shown.length} />
				</>
			)}
		</WidgetFrame>
	);
}
