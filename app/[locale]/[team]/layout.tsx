import { fetchQuery } from "convex/nextjs";
import { getTranslations } from "next-intl/server";
import type React from "react";
import { api } from "@/convex/_generated/api";

type Props = {
	children: React.ReactNode;
	params: Promise<{ locale: string; team: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { locale, team: teamSlug } = await params;
	const t = await getTranslations({ locale });

	try {
		const team = await fetchQuery(api.queries.getTeam, { teamSlug });

		if (team?.name) {
			return {
				title: `${team.name} ${t("pr.title")}`,
				description: t("description"),
			};
		}
	} catch {
		// If we can't fetch the team, fall back to default
	}

	// Fallback: just "PR Review" / "Revisión PR" without team prefix
	return {
		title: t("pr.title"),
		description: t("description"),
	};
}

export default function TeamLayout({ children }: Props) {
	return <>{children}</>;
}
