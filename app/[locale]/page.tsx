"use client";

import { useQuery } from "convex/react";
import { ArrowRight, GitPullRequest, Plus } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

function getTeamInitials(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");
}

export default function Page() {
	const t = useTranslations();
	const locale = useLocale();
	const teams = useQuery(api.queries.getTeams);
	const reviewedPRsCount = useQuery(api.queries.getGlobalReviewedPRCount);
	const [animatedReviewedPRs, setAnimatedReviewedPRs] = useState(0);
	const [isCounterAnimating, setIsCounterAnimating] = useState(false);
	const hasAnimatedOnOpenRef = useRef(false);
	const currentValueRef = useRef(0);
	const rafIdRef = useRef<number | null>(null);
	const settleTimeoutRef = useRef<number | null>(null);

	const isLoading = teams === undefined || reviewedPRsCount === undefined;
	const teamsList = teams ?? [];

	useEffect(() => {
		if (reviewedPRsCount === undefined) {
			return;
		}

		const animateCount = (startValue: number, endValue: number) => {
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
			if (settleTimeoutRef.current !== null) {
				clearTimeout(settleTimeoutRef.current);
				settleTimeoutRef.current = null;
			}

			if (startValue === endValue) {
				currentValueRef.current = endValue;
				setAnimatedReviewedPRs(endValue);
				setIsCounterAnimating(false);
				return;
			}

			setIsCounterAnimating(true);
			const durationMs = 1400;
			const startTime = performance.now();

			const step = (now: number) => {
				const elapsed = now - startTime;
				const progress = Math.min(elapsed / durationMs, 1);
				const easedProgress =
					progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
				const nextValue = Math.round(
					startValue + (endValue - startValue) * easedProgress,
				);
				currentValueRef.current = nextValue;
				setAnimatedReviewedPRs(nextValue);

				if (progress < 1) {
					rafIdRef.current = requestAnimationFrame(step);
					return;
				}

				currentValueRef.current = endValue;
				setAnimatedReviewedPRs(endValue);
				settleTimeoutRef.current = window.setTimeout(() => {
					setIsCounterAnimating(false);
					settleTimeoutRef.current = null;
				}, 180);
				rafIdRef.current = null;
			};

			rafIdRef.current = requestAnimationFrame(step);
		};

		if (!hasAnimatedOnOpenRef.current) {
			hasAnimatedOnOpenRef.current = true;
			currentValueRef.current = 0;
			setAnimatedReviewedPRs(0);
			animateCount(0, reviewedPRsCount);
			return;
		}

		const fromValue = currentValueRef.current;
		if (fromValue !== reviewedPRsCount) {
			animateCount(fromValue, reviewedPRsCount);
		}
	}, [reviewedPRsCount]);

	useEffect(() => {
		return () => {
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
			}
			if (settleTimeoutRef.current !== null) {
				clearTimeout(settleTimeoutRef.current);
			}
		};
	}, []);

	return (
		<div className="relative overflow-hidden">
			<div
				aria-hidden
				className="pointer-events-none absolute -top-24 -left-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
			/>

			<div className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
				<div className="space-y-2">
					<p className="inline-flex items-center border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
						La Lista
					</p>
					<h1 className="text-4xl md:text-5xl font-bold tracking-tight">
						{t("team.switcher.title")}
					</h1>
					<p className="max-w-2xl text-base text-muted-foreground md:text-lg">
						{t("team.switcher.description")}
					</p>
				</div>

				<div className="mt-5 py-3 md:py-4">
					<p className="flex items-center gap-2 text-sm md:text-base text-muted-foreground">
						<GitPullRequest className="h-4 w-4 shrink-0 opacity-80" />
						<span className="leading-relaxed">
							{t.rich("team.switcher.reviewedSummaryRich", {
								count: animatedReviewedPRs.toLocaleString(locale),
								highlight: (chunks) => (
									<span
										className={`inline-block px-1 text-xl md:text-2xl font-bold tabular-nums align-middle transition-all duration-300 ${
											isCounterAnimating
												? "scale-110 text-primary"
												: "scale-100 text-foreground"
										}`}
									>
										{chunks}
									</span>
								),
							})}
						</span>
					</p>
				</div>

				<div className="mt-12 mb-4 flex items-center justify-between gap-4 flex-wrap md:mt-14 md:flex-nowrap">
					<h2 className="text-xl font-semibold">
						{t("team.switcher.teamListTitle")}
					</h2>
					<Button
						asChild
						className="shrink-0 shadow-[0_8px_24px_-12px_hsl(var(--primary))]"
					>
						<Link href={`/${locale}/create-team`}>
							<Plus className="h-4 w-4" />
							{t("team.createButton")}
						</Link>
					</Button>
				</div>

				{isLoading ? (
					<div className="mt-0 border bg-background/60 p-6 text-sm text-muted-foreground">
						{t("common.loading")}
					</div>
				) : teamsList.length === 0 ? (
					<div className="mt-0 border bg-background/60 p-6 space-y-3">
						<p className="font-medium">{t("team.switcher.emptyTitle")}</p>
						<p className="text-sm text-muted-foreground">
							{t("team.switcher.emptyDescription")}
						</p>
						<Button asChild variant="outline">
							<Link href={`/${locale}/create-team`}>
								<Plus className="h-4 w-4" />
								{t("team.createTitle")}
							</Link>
						</Button>
					</div>
				) : (
					<div className="mt-0 grid gap-3 md:grid-cols-2">
						{teamsList.map((team) => (
							<Link
								key={team._id}
								href={`/${locale}/${team.slug}`}
								className="group relative overflow-hidden border border-border/70 bg-gradient-to-b from-background/90 to-background/40 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-muted/40"
							>
								<div
									aria-hidden
									className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(135deg,transparent_25%,hsl(var(--primary)/0.12)_100%)]"
								/>
								<div className="relative flex h-full min-h-28 flex-col justify-between gap-3">
									<div className="flex items-start justify-between gap-3">
										<div className="inline-flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/10 text-xs font-semibold tracking-wide text-primary">
											{getTeamInitials(team.name) || "TM"}
										</div>
										<div className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
											<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
										</div>
									</div>
									<div className="min-w-0">
										<p className="font-semibold text-xl leading-tight truncate">
											{team.name}
										</p>
										<p className="mt-1 text-sm text-muted-foreground font-mono truncate">
											/{team.slug}
										</p>
									</div>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
