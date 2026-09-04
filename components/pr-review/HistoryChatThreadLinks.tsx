"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { legacyChatThreadLinks } from "@/lib/assignmentHistory";
import type { GroupedAssignmentHistoryItem } from "@/lib/types";

export function HistoryChatThreadLinks({
	item,
}: {
	item: Pick<
		GroupedAssignmentHistoryItem,
		"googleChatThreadUrl" | "googleChatThreadUrls"
	>;
}) {
	const t = useTranslations();
	const links = legacyChatThreadLinks(
		item.googleChatThreadUrl,
		item.googleChatThreadUrls,
	);
	if (links.length === 0) return null;

	return (
		<>
			{links.map((link) => (
				<Button
					key={`${link.teamSlug}-${link.url}`}
					variant="ghost"
					size="xs"
					asChild
				>
					<Link href={link.url} target="_blank" rel="noreferrer noopener">
						<MessageSquare aria-hidden="true" />
						{links.length > 1
							? t("common.viewChatThreadForTeam", { team: link.teamName })
							: t("common.viewChatThread")}
					</Link>
				</Button>
			))}
		</>
	);
}
