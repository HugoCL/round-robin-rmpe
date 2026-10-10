import { useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { birthdaySetupDismissedKey } from "@/components/pr-review/BirthdaySetupBanner";
import { isMcpLaunchDismissed } from "@/components/settings/McpLaunchBanner";
import { api } from "@/convex/_generated/api";
import { usePRReview } from "../PRReviewContext";

const CLOCK_TICK_MS = 60_000;

function readLocalFlag(key: string) {
	try {
		return window.localStorage.getItem(key) === "true";
	} catch {
		return false;
	}
}

/**
 * How many notices the "Avisos" sheet would show: the same conditions each
 * banner checks before rendering, so the menu can show a dot without
 * mounting them. `refresh` re-reads the dismissals and the clock: call it when
 * the sheet closes, the only place those notices can be dismissed.
 */
export function usePendingNoticesCount() {
	const { teamSlug, reviewers, userInfo, canManageCurrentTeam } = usePRReview();
	const [now, setNow] = useState(() => Date.now());
	// A survey that expires while the page stays open must leave the count.
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
		return () => window.clearInterval(id);
	}, []);
	const [local, setLocal] = useState({
		mcpDismissed: true,
		birthdayDismissed: true,
	});
	const announcements = useQuery(api.announcements.listForMe, { teamSlug });
	const survey = useQuery(api.surveys.getActiveSurveyForMe, { now });
	const tokens = useQuery(api.agent.getMyAgentTokens);

	const readDismissals = useCallback(() => {
		setLocal({
			mcpDismissed: isMcpLaunchDismissed(),
			birthdayDismissed: readLocalFlag(
				birthdaySetupDismissedKey(userInfo?.email ?? ""),
			),
		});
	}, [userInfo?.email]);
	// localStorage only exists after mount; until then nothing counts.
	useEffect(readDismissals, [readDismissals]);

	const me = userInfo?.email
		? reviewers.find(
				(reviewer) =>
					reviewer.email.toLowerCase() === userInfo.email.toLowerCase(),
			)
		: undefined;
	const birthdayMissing =
		!!teamSlug &&
		canManageCurrentTeam &&
		!!me &&
		(me.birthdayMonth === undefined || me.birthdayDay === undefined) &&
		!local.birthdayDismissed;
	const mcpPending =
		tokens !== undefined &&
		!tokens.some((token) => !token.revokedAt) &&
		!local.mcpDismissed;

	const count =
		(announcements?.length ?? 0) +
		(survey ? 1 : 0) +
		(mcpPending ? 1 : 0) +
		(birthdayMissing ? 1 : 0);
	const refresh = () => {
		setNow(Date.now());
		readDismissals();
	};

	return { count, refresh };
}
