import type { useTranslations } from "next-intl";
import { diffInDays } from "@/lib/plannedAbsences";
import { getLocalDateKeyYYYYMMDD } from "@/lib/reviewerAvailability";

/** Up to this many days ahead the return reads "tomorrow" or "in 5 days"; later ones show the date. */
const RELATIVE_RETURN_MAX_DAYS = 7;

/** When a manually absent reviewer is back, counted in calendar days of the team's time zone. */
export function describeReturn(
	t: ReturnType<typeof useTranslations>,
	locale: string,
	timeZone: string,
	absentUntil: number,
	now: number = Date.now(),
): string {
	const today = getLocalDateKeyYYYYMMDD(now, timeZone);
	const returnDay = getLocalDateKeyYYYYMMDD(absentUntil, timeZone);
	const days = Math.max(0, diffInDays(today, returnDay));
	if (days <= RELATIVE_RETURN_MAX_DAYS) {
		return t("partTime.returningRelative", {
			when: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
				days,
				"day",
			),
		});
	}
	return t("partTime.returningOn", {
		date: new Intl.DateTimeFormat(locale, {
			timeZone,
			weekday: "short",
			day: "numeric",
			month: "short",
			year: returnDay.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
		}).format(absentUntil),
	});
}
