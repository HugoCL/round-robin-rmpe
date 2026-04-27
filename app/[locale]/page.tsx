"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ArrowRight, Lightbulb, Plus } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LandingAssignmentTicker } from "@/components/LandingAssignmentTicker";
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
	const { user } = useUser();
	const teams = useQuery(api.queries.getTeams);
	const onboardingState = useQuery(api.queries.getMyOnboardingState);
	const reviewedPRsCount = useQuery(api.queries.getGlobalReviewedPRCount);
	const [animatedReviewedPRs, setAnimatedReviewedPRs] = useState(0);
	const [isCounterAnimating, setIsCounterAnimating] = useState(false);
	const hasAnimatedOnOpenRef = useRef(false);
	const currentValueRef = useRef(0);
	const rafIdRef = useRef<number | null>(null);
	const settleTimeoutRef = useRef<number | null>(null);

	const isLoading = teams === undefined || reviewedPRsCount === undefined;
	const teamsList = teams ?? [];
	const shouldShowOnboardingPrompt =
		!!user &&
		onboardingState !== undefined &&
		!onboardingState.isAdmin &&
		!onboardingState.hasTeams;

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
				className="pointer-events-none absolute -top-24 left-0 h-72 w-72 rounded-full bg-primary/12 blur-3xl"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute top-24 right-0 h-80 w-80 rounded-full bg-primary/8 blur-3xl"
			/>
			<div className="container mx-auto max-w-6xl px-4 py-8 md:py-10">
				<section className="page-enter-soft calm-shell relative overflow-hidden px-5 py-8 md:px-8 md:py-10">
					<div
						aria-hidden
						className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)] md:block"
					/>
					<div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-center">
						<div className="space-y-6">
							<div className="space-y-3">
								<p className="calm-kicker">La Lista</p>
								<h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
									{t("team.switcher.title")}
								</h1>
								<p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
									{t("team.switcher.description")}
								</p>
							</div>

							<div className="flex flex-wrap items-center gap-3">
								<Button asChild size="lg" className="rounded-full px-5">
									<Link href={`/${locale}/create-team`}>
										<Plus className="h-4 w-4" />
										{t("team.createButton")}
									</Link>
								</Button>
								<Button
									asChild
									variant="outline"
									size="lg"
									className="rounded-full border-border/70 bg-background/70 px-5"
								>
									<Link href={`/${locale}/suggestions`}>
										<Lightbulb className="h-4 w-4" />
										{t("suggestions.openBoard")}
									</Link>
								</Button>
							</div>
						</div>

						<div className="page-enter flex items-center justify-start lg:justify-end">
							<div
								className={`relative w-full max-w-md overflow-hidden rounded-[2rem] border border-primary/16 bg-background/78 px-6 py-7 shadow-[0_28px_80px_-52px_rgba(37,99,235,0.55)] ring-1 ring-primary/12 backdrop-blur-sm transition-all duration-500 md:px-7 md:py-8 ${
									isCounterAnimating
										? "border-primary/28 shadow-[0_34px_96px_-54px_rgba(37,99,235,0.72)]"
										: ""
								}`}
							>
								<div
									aria-hidden
									className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_42%),radial-gradient(circle_at_82%_18%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_36%)]"
								/>
								<div className="relative flex flex-col gap-4">
									<div className="flex items-center justify-between gap-4">
										<p className="calm-kicker">
											{t("team.switcher.reviewedSummaryLabel")}
										</p>
									</div>
									<div
										className={`text-6xl font-semibold leading-none tracking-tight text-foreground transition-all duration-300 [font-family:var(--font-display),var(--font-sans),sans-serif] md:text-7xl ${
											isCounterAnimating
												? "scale-[1.02] text-primary"
												: "scale-100"
										}`}
									>
										{animatedReviewedPRs.toLocaleString(locale)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section className="page-enter mt-6">
					<LandingAssignmentTicker />
				</section>

				{shouldShowOnboardingPrompt ? (
					<section className="page-enter mt-6">
						<div className="calm-section flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="space-y-1">
								<p className="text-sm font-medium">{t("onboarding.title")}</p>
								<p className="text-sm text-muted-foreground">
									{t("onboarding.description")}
								</p>
							</div>
							<Button asChild className="rounded-full px-5">
								<Link href={`/${locale}/onboarding`}>
									{t("onboarding.continueCta")}
								</Link>
							</Button>
						</div>
					</section>
				) : null}

				<div className="mt-8 mb-3 flex flex-wrap items-end justify-between gap-4">
					<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
						{t("team.switcher.teamListTitle")}
					</h2>
				</div>

				{isLoading ? (
					<div className="calm-section text-sm text-muted-foreground">
						{t("common.loading")}
					</div>
				) : teamsList.length === 0 ? (
					<div className="calm-section max-w-2xl space-y-3">
						<p className="calm-kicker">La Lista</p>
						<p className="text-xl font-semibold">
							{t("team.switcher.emptyTitle")}
						</p>
						<p className="text-sm text-muted-foreground">
							{t("team.switcher.emptyDescription")}
						</p>
						<Button asChild className="w-fit rounded-full px-5">
							<Link href={`/${locale}/create-team`}>
								<Plus className="h-4 w-4" />
								{t("team.createTitle")}
							</Link>
						</Button>
					</div>
				) : (
					<div className="calm-list">
						{teamsList.map((team) => (
							<Link
								key={team._id}
								href={`/${locale}/${team.slug}`}
								className="group relative flex items-center justify-between gap-4 px-4 py-4 transition-colors duration-200 hover:bg-muted/30 md:px-5"
							>
								<div className="flex min-w-0 items-center gap-4">
									<div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8 text-xs font-semibold tracking-[0.18em] text-primary">
										{getTeamInitials(team.name) || "TM"}
									</div>
									<div className="min-w-0">
										<p className="truncate text-lg font-semibold leading-tight">
											{team.name}
										</p>
										<p className="mt-1 truncate font-mono text-xs text-muted-foreground">
											/{team.slug}
										</p>
									</div>
								</div>
								<div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/75 text-muted-foreground transition-all duration-200 group-hover:border-primary/30 group-hover:text-primary">
									<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
