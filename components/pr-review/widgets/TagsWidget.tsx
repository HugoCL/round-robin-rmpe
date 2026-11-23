"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useConvexTags } from "@/hooks/useConvexTags";
import { usePRReview } from "../PRReviewContext";
import { widgetRowClass } from "./parts";
import { WidgetFrame } from "./WidgetFrame";

function TagRow({ teamSlug, tag }: { teamSlug: string; tag: Doc<"tags"> }) {
	const t = useTranslations();
	const next = useQuery(api.queries.getNextReviewerByTag, {
		teamSlug,
		tagId: tag._id,
	});

	return (
		<li className={widgetRowClass}>
			<span
				className="size-2 shrink-0 rounded-full"
				style={{ backgroundColor: tag.color }}
				aria-hidden="true"
			/>
			<span className="min-w-0 flex-1 truncate">{tag.name}</span>
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

/** Who each tag's rotation picks next. */
export function TagsWidget() {
	const t = useTranslations();
	const { teamSlug } = usePRReview();
	const { tags } = useConvexTags(teamSlug);

	return (
		<WidgetFrame meta={t("widgets.tags.nextUp")}>
			<ul>
				{teamSlug
					? tags.map((tag) => (
							<TagRow key={tag._id} teamSlug={teamSlug} tag={tag} />
						))
					: null}
			</ul>
		</WidgetFrame>
	);
}
