"use client";

import { PartyPopper } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { reviewerHasBirthdayToday } from "@/lib/reviewerAvailability";
import { NoticeLine } from "./NoticeLine";
import { usePRReview } from "./PRReviewContext";

export function BirthdayTeamNoticeBanner({
	teamTimezone,
}: {
	teamTimezone: string;
}) {
	const t = useTranslations("birthday");
	const { reviewers, userInfo } = usePRReview();
	const [dismissedFor, setDismissedFor] = useLocalStorage<string | null>(
		"la-lista-birthday-notice-dismissed",
		null,
	);

	const names = useMemo(() => {
		if (!userInfo?.email) return [];
		const selfEmail = userInfo.email.toLowerCase();
		return reviewers
			.filter((r) => reviewerHasBirthdayToday(r, teamTimezone))
			.filter((r) => r.email.toLowerCase() !== selfEmail)
			.map((r) => r.name);
	}, [reviewers, userInfo?.email, teamTimezone]);

	// Dismissing hides today's notice only: another day or another name brings
	// it back.
	const today = new Intl.DateTimeFormat("en-CA", {
		timeZone: teamTimezone,
	}).format(new Date());
	const noticeKey = `${today}|${names.join(",")}`;

	if (names.length === 0 || dismissedFor === noticeKey) return null;

	const list =
		names.length === 1
			? names[0]
			: `${names.slice(0, -1).join(", ")} ${t("and")} ${names[names.length - 1]}`;

	return (
		<NoticeLine icon={PartyPopper} onDismiss={() => setDismissedFor(noticeKey)}>
			<span className="sr-only">{t("teamNoticeTitle")}</span>
			<span>{t("teamNoticeDescription", { names: list })}</span>
		</NoticeLine>
	);
}
