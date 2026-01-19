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

	if (team === undefined) {
		return (
			<div className="container mx-auto py-10 flex items-center justify-center h-[50vh]">
				<div className="text-center space-y-2">
					<h2 className="text-xl font-semibold">{t("common.loading")}</h2>
					<p className="text-muted-foreground">{t("pr.loadingPleaseWait")}</p>
				</div>
			</div>
		);
	}

	if (!team) {
		return (
			<div className="container mx-auto py-10 flex items-center justify-center min-h-[50vh]">
				<div className="max-w-xl text-center space-y-4">
					<h1 className="text-3xl font-bold">{t("team.notFoundTitle")}</h1>
					<p className="text-muted-foreground">
						{t.rich("team.notFoundDescription", {
							slug: teamSlug,
							code: (chunks) => (
								<code className="px-1 py-0.5  bg-muted font-mono text-sm">
									{chunks}
								</code>
							),
						})}
					</p>
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Link
							href={`/${locale}/create-team`}
							className="inline-flex items-center justify-center  bg-primary px-4 py-2 text-primary-foreground text-sm font-medium hover:opacity-90 transition"
						>
							{t("team.createThisTeamCta")}
						</Link>
						<Link
							href={`/${locale}`}
							className="inline-flex items-center justify-center  border px-4 py-2 text-sm font-medium hover:bg-muted transition"
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
