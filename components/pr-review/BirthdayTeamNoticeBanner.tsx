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
		<Alert
			data-notice
			className="flex min-h-11 items-center gap-2.5 rounded-xl border-primary/20 bg-primary/[0.04] py-2.5 shadow-none"
		>
			<PartyPopper className="shrink-0 text-primary" />
			<AlertTitle className="sr-only">{t("teamNoticeTitle")}</AlertTitle>
			<AlertDescription className="line-clamp-2 text-xs sm:text-sm">
				{t("teamNoticeDescription", { names: list })}
			</AlertDescription>
		</Alert>
	);
}
