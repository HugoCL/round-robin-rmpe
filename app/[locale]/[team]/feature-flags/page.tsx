"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FeatureFlagsBoard } from "@/components/feature-flags/FeatureFlagsBoard";
import { api } from "@/convex/_generated/api";

export default function FeatureFlagsPage() {
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
					<p className="calm-kicker">{t("featureFlags.title")}</p>
					<h2 className="text-xl font-semibold">{t("common.loading")}</h2>
				</div>
			</div>
		);
	}

	if (team === null) {
		return (
			<div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-10">
				<div className="calm-section page-enter max-w-xl text-center">
					<h2 className="text-xl font-semibold">
						{t("featureFlags.notFoundTitle")}
					</h2>
					<p className="mt-2 text-muted-foreground">
						{t("featureFlags.notFoundDescription")}
					</p>
					<Link
						href={`/${locale}`}
						className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						{t("featureFlags.backHome")}
					</Link>
				</div>
			</div>
		);
	}

	return (
		<FeatureFlagsBoard
			teamSlug={teamSlug}
			canManage={accessContext.canManageCurrentTeam}
		/>
	);
}
