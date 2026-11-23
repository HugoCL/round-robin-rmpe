"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { ActiveEventsList } from "../ActiveEventsList";
import { usePRReview } from "../PRReviewContext";
import { WidgetEmpty } from "./parts";
import { WidgetFrame } from "./WidgetFrame";

/** The team's upcoming events. While it is in the view, the notice lane above the card leaves them to it. */
export function EventsWidget() {
	const t = useTranslations();
	const { teamSlug } = usePRReview();
	const events = useQuery(
		api.queries.getActiveEvents,
		teamSlug ? { teamSlug } : "skip",
	);

	return (
		<WidgetFrame>
			{events?.length === 0 ? (
				<WidgetEmpty>{t("events.noUpcoming")}</WidgetEmpty>
			) : (
				<div className="flex flex-col divide-y divide-border/50">
					<ActiveEventsList />
				</div>
			)}
		</WidgetFrame>
	);
}
