"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { usePRReview } from "../PRReviewContext";
import { WidgetEmpty, widgetRowClass } from "./parts";
import { WidgetFrame } from "./WidgetFrame";

function TeamRow({ slug, name }: { slug: string; name: string }) {
	const t = useTranslations();
	const locale = useLocale();
	const next = useQuery(api.queries.getNextReviewer, { teamSlug: slug });

	return (
		<li className={widgetRowClass}>
			<Link
				href={`/${locale}/${slug}`}
				className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
			>
				{name}
			</Link>
			{next === undefined ? null : next ? (
				<span className="truncate font-medium">{next.name}</span>
			) : (
				<span className="text-muted-foreground">
					{t("widgets.tags.nobody")}
				</span>
			)}
		</li>
	);
}

/** Who is next on every other team, for a cross-team review. */
export function OtherTeamsWidget() {
	const t = useTranslations();
	const { teamSlug } = usePRReview();
	const teams = useQuery(api.queries.getTeams);
	const others = (teams ?? []).flatMap((team) =>
		team && typeof team.slug === "string" && team.slug !== teamSlug
			? [{ slug: team.slug, name: team.name }]
			: [],
	);

	return (
		<WidgetFrame meta={t("widgets.tags.nextUp")}>
			{teams !== undefined && others.length === 0 ? (
				<WidgetEmpty>{t("widgets.otherTeams.empty")}</WidgetEmpty>
			) : (
				<ul>
					{others.map((team) => (
						<TeamRow key={team.slug} slug={team.slug} name={team.name} />
					))}
				</ul>
			)}
		</WidgetFrame>
	);
}
