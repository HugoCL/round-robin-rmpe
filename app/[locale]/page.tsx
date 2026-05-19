"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ArrowRight, Lightbulb, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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
	const router = useRouter();
	const { user, isLoaded: userLoaded } = useUser();
	const teams = useQuery(api.queries.getTeams);
	const onboardingState = useQuery(api.queries.getMyOnboardingState);
	const reviewedPRsCount = useQuery(api.queries.getGlobalReviewedPRCount);
	const [redirecting, setRedirecting] = useState(false);

	const isLoading =
		!userLoaded || teams === undefined || reviewedPRsCount === undefined;
	const teamsList = teams ?? [];
	const shouldShowOnboardingPrompt =
		!!user &&
		onboardingState !== undefined &&
		!onboardingState.isAdmin &&
		!onboardingState.hasTeams;

	useEffect(() => {
		if (userLoaded && user && teams && teams.length > 0 && !redirecting) {
			try {
				const lastTeam = window.localStorage.getItem("la-lista-last-team");
				const targetTeam = teams.find((t) => t.slug === lastTeam) || teams[0];
				if (targetTeam) {
					setRedirecting(true);
					router.push(`/${locale}/${targetTeam.slug}`);
				}
			} catch (e) {
				console.warn("Failed to retrieve or redirect to last visited team:", e);
			}
		}
	}, [userLoaded, user, teams, locale, router, redirecting]);

	const isRedirecting = userLoaded && user && teams && teams.length > 0;
	if (isLoading || isRedirecting || redirecting) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-2">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
					<p className="text-sm text-muted-foreground">{t("common.loading")}</p>
				</div>
			</div>
		);
	}

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
					<div className="relative flex flex-col gap-6 md:max-w-3xl">
						<div className="space-y-6">
							<div className="space-y-3">
								<p className="calm-kicker">La Lista</p>
								<h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
									{t("team.switcher.title")}
								</h1>
								<p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
									{t("team.switcher.description")}
								</p>
								{reviewedPRsCount !== undefined && (
									<div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3.5 py-1.5 text-xs text-muted-foreground md:text-sm">
										<span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
										<span>
											{t("team.switcher.reviewedSummaryLabel")}{" "}
											<strong>{reviewedPRsCount.toLocaleString(locale)}</strong>
										</span>
									</div>
								)}
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
