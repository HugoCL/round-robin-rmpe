"use client";

import { PartyPopper } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { reviewerHasBirthdayToday } from "@/lib/reviewerAvailability";
import { usePRReview } from "./PRReviewContext";

export function BirthdayTeamNoticeBanner({
	teamTimezone,
}: {
	teamTimezone: string;
}) {
	const t = useTranslations("birthday");
	const { reviewers, userInfo } = usePRReview();

	const names = useMemo(() => {
		if (!userInfo?.email) return [];
		const selfEmail = userInfo.email.toLowerCase();
		return reviewers
			.filter((r) => reviewerHasBirthdayToday(r, teamTimezone))
			.filter((r) => r.email.toLowerCase() !== selfEmail)
			.map((r) => r.name);
	}, [reviewers, userInfo?.email, teamTimezone]);

	if (names.length === 0) return null;

	const list =
		names.length === 1
			? names[0]
			: `${names.slice(0, -1).join(", ")} ${t("and")} ${names[names.length - 1]}`;

	return (
		<Alert className="border-sky-500/35 bg-sky-500/[0.06] text-sky-950 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-50">
			<PartyPopper className="h-4 w-4 text-sky-600 dark:text-sky-300" />
			<AlertTitle>{t("teamNoticeTitle")}</AlertTitle>
			<AlertDescription className="text-sm text-sky-900/90 dark:text-sky-50/90">
				{t("teamNoticeDescription", { names: list })}
			</AlertDescription>
		</Alert>
	);
}
