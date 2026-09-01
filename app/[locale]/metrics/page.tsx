"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { SecondaryPageNav } from "@/components/SecondaryPageNav";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";

export default function MetricsPage() {
	const locale = useLocale();
	const t = useTranslations("metrics");
	// The query requires an identity, so it waits for Clerk's token instead of
	// firing unauthenticated and throwing on a cold page load.
	const { isAuthenticated, isLoading } = useConvexAuth();
	const metrics = useQuery(
		api.queries.getWebsiteMetrics,
		isAuthenticated ? {} : "skip",
	);

	if (isLoading || !isAuthenticated || metrics === undefined) {
		return <MetricsSkeleton />;
	}

	const maximumDailyCount = Math.max(
		1,
		...metrics.recent.dailyActivity.map((day) => day.count),
	);
	const dateFormatter = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		timeZone: "UTC",
	});
	const hasRecentActivity = metrics.recent.total > 0;

	return (
		<>
			<SecondaryPageNav />
			<main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
				<div className="space-y-6">
					<header className="page-enter-soft max-w-3xl space-y-3">
						<p className="calm-kicker">La Lista</p>
						<h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
							{t("title")}
						</h1>
						<p className="text-pretty text-lg leading-8 text-muted-foreground md:text-xl">
							{t.rich("headline", {
								count: () => (
									<strong className="font-semibold text-foreground tabular-nums">
										{metrics.reviewedPRs.toLocaleString(locale)}
									</strong>
								),
							})}
						</p>
					</header>

					<section className="page-enter calm-shell overflow-hidden">
						<h2 className="sr-only">{t("overview")}</h2>
						<dl className="grid divide-y divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
							<Metric
								label={t("teams")}
								value={metrics.teams.toLocaleString(locale)}
							/>
							<Metric
								label={t("reviewers")}
								value={metrics.reviewers.toLocaleString(locale)}
							/>
							<Metric
								label={t("activeAssignments")}
								value={metrics.activeAssignments.toLocaleString(locale)}
							/>
						</dl>
					</section>

					<section
						className="page-enter calm-section"
						aria-labelledby="recent-activity-heading"
					>
						<div className="calm-section-header">
							<div className="space-y-1">
								<p className="calm-kicker">{t("lastSevenDays")}</p>
								<h2
									id="recent-activity-heading"
									className="text-xl font-semibold tracking-tight"
								>
									{t("recentActivity", {
										count: metrics.recent.total.toLocaleString(locale),
									})}
								</h2>
							</div>
						</div>

						{hasRecentActivity ? (
							<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
								<ol
									className="grid h-48 grid-cols-7 items-end gap-2 border-b border-border/70 px-1"
									aria-label={t("dailyActivity")}
								>
									{metrics.recent.dailyActivity.map((day) => {
										const date = new Date(`${day.date}T00:00:00Z`);
										const dayLabel = dateFormatter.format(date);

										return (
											<li
												key={day.date}
												className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
												aria-label={t("daySummary", {
													day: dayLabel,
													count: day.count,
												})}
											>
												<span className="text-xs font-medium tabular-nums">
													{day.count.toLocaleString(locale)}
												</span>
												<div
													className="w-full max-w-10 rounded-t-md bg-primary/80"
													style={{
														// A zero draws nothing: a stub bar reads as a small value.
														height:
															day.count === 0
																? "0%"
																: `${Math.max(6, (day.count / maximumDailyCount) * 100)}%`,
													}}
												/>
												<span className="pb-2 text-[11px] capitalize text-muted-foreground">
													{dayLabel}
												</span>
											</li>
										);
									})}
								</ol>

								<div className="self-start">
									<h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
										{t("breakdownLabel")}
									</h3>
									<dl className="calm-list">
										<BreakdownMetric
											label={t("viaAgent")}
											value={metrics.recent.viaAgent.toLocaleString(locale)}
										/>
										<BreakdownMetric
											label={t("urgent")}
											value={metrics.recent.urgent.toLocaleString(locale)}
										/>
										<BreakdownMetric
											label={t("crossTeam")}
											value={metrics.recent.crossTeam.toLocaleString(locale)}
										/>
									</dl>
								</div>
							</div>
						) : (
							<div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
								<p className="text-base font-medium">{t("emptyWeekTitle")}</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{t("emptyWeekDescription")}
								</p>
							</div>
						)}

						<p className="text-xs leading-5 text-muted-foreground">
							{t("scopeNote")}
						</p>
					</section>
				</div>
			</main>
		</>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="space-y-1 px-5 py-5 md:px-6">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="text-2xl font-semibold tabular-nums">{value}</dd>
		</div>
	);
}

function BreakdownMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4 px-4 py-3">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="font-medium tabular-nums">{value}</dd>
		</div>
	);
}

function MetricsSkeleton() {
	return (
		<>
			<SecondaryPageNav />
			<main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
				<div className="space-y-6">
					<header className="max-w-3xl space-y-3">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-9 w-52" />
						<Skeleton className="h-7 w-full max-w-xl" />
					</header>
					<section className="calm-shell grid divide-y divide-border/60 overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-y-0">
						{["teams", "reviewers", "assignments"].map((item) => (
							<div key={item} className="space-y-2 px-5 py-5 md:px-6">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-8 w-16" />
							</div>
						))}
					</section>
					<section className="calm-section">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-48 w-full" />
					</section>
				</div>
			</main>
		</>
	);
}
