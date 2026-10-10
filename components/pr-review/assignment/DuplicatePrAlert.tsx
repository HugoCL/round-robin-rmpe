import { AlertTriangle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DuplicateAssignment } from "../hooks/useDuplicatePrCheck";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A warning, not an error: re-assigning the same PR is allowed on purpose. */
export function DuplicatePrAlert({
	duplicate,
	action,
}: {
	duplicate: DuplicateAssignment;
	/** A way out, shown inline after the text (e.g. pick someone else). */
	action?: ReactNode;
}) {
	const t = useTranslations();
	const locale = useLocale();

	const startOfToday = new Date().setHours(0, 0, 0, 0);
	const time = new Intl.DateTimeFormat(locale, {
		hour: "2-digit",
		minute: "2-digit",
	}).format(duplicate.timestamp);
	const when =
		duplicate.timestamp >= startOfToday
			? t("messages.duplicateWhenToday", { time })
			: duplicate.timestamp >= startOfToday - DAY_MS
				? t("messages.duplicateWhenYesterday", { time })
				: t("messages.duplicateWhenDate", {
						date: new Intl.DateTimeFormat(locale, {
							day: "numeric",
							month: "short",
						}).format(duplicate.timestamp),
					});

	return (
		<Alert className="border-amber-500/30 bg-amber-500/[0.06] text-foreground *:[svg]:text-amber-600 dark:*:[svg]:text-amber-400">
			<AlertTriangle className="h-4 w-4" aria-hidden="true" />
			<AlertDescription>
				{t("messages.duplicatePRAssigned", {
					reviewer: duplicate.reviewerName,
					when,
				})}
				{action ? <> {action}</> : null}
			</AlertDescription>
		</Alert>
	);
}
