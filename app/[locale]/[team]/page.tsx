"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import PRReviewAssignment from "@/components/pr-review/PRReviewAssignment";
import { api } from "@/convex/_generated/api";

export default function TeamPage() {
	const params = useParams<{ team: string }>();
	const teamSlug = params.team;
	const t = useTranslations();
	const locale = useLocale();
	const team = useQuery(api.queries.getTeam, { teamSlug });
	const accessContext = useQuery(api.queries.getMyTeamAccess, {
		teamSlug: teamSlug ?? undefined,
	});

	if (team === undefined || accessContext === undefined) {
		return (
			<div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-10">
				<div className="calm-section page-enter max-w-xl text-center">
					<p className="calm-kicker">{t("pr.title")}</p>
					<h2 className="text-xl font-semibold">{t("common.loading")}</h2>
					<p className="text-muted-foreground">{t("pr.loadingPleaseWait")}</p>
				</div>
			</div>
		);
	}

	if (
		accessContext.isAuthenticated &&
		!accessContext.isAdmin &&
		accessContext.memberTeamSlugs.length === 0
	) {
		return (
			<div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-10">
				<div className="calm-section page-enter max-w-xl text-center space-y-3">
					<p className="calm-kicker">{t("pr.title")}</p>
					<h1 className="text-2xl font-semibold">{t("onboarding.title")}</h1>
					<p className="text-muted-foreground">
						{t("onboarding.teamRequiredDescription")}
					</p>
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Link
							href={`/${locale}/onboarding`}
							className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
						>
							{t("onboarding.continueCta")}
						</Link>
						<Link
							href={`/${locale}`}
							className="inline-flex items-center justify-center rounded-full border border-border/70 bg-background/70 px-5 py-2.5 text-sm font-medium transition hover:bg-muted/40"
						>
							{t("team.backHome")}
						</Link>
					</div>
				</div>
			</div>
		);
	}

	if (!team) {
		return (
			<div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-10">
				<div className="calm-section page-enter max-w-xl text-center">
					<p className="calm-kicker">{t("pr.title")}</p>
					<h1 className="text-3xl font-bold">{t("team.notFoundTitle")}</h1>
					<p className="text-muted-foreground">
						{t.rich("team.notFoundDescription", {
							slug: teamSlug,
							code: (chunks) => (
								<code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm">
									{chunks}
								</code>
							),
						})}
					</p>
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Link
							href={`/${locale}/create-team`}
							className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
						>
							{t("team.createThisTeamCta")}
						</Link>
						<Link
							href={`/${locale}`}
							className="inline-flex items-center justify-center rounded-full border border-border/70 bg-background/70 px-5 py-2.5 text-sm font-medium transition hover:bg-muted/40"
						>
							{t("team.backHome")}
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return <PRReviewAssignment teamSlug={teamSlug} />;
}
