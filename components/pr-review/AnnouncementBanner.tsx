"use client";

import { useMutation, useQuery } from "convex/react";
import { Info, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { resolveAnnouncementBody } from "@/lib/announcementVisibility";
import { usePRReview } from "./PRReviewContext";

/**
 * Keys that were dismissed into localStorage before dismissals moved to
 * Convex. Imported once per browser so nobody sees four retired banners come
 * back the day this ships.
 */
const LEGACY_DISMISSAL_KEYS = [
	"coord-la-lista-v1",
	"create-event-navbar-v1",
	"reviewers-panel-v1",
	"mcp-setup-wizard-v1",
];
const LEGACY_IMPORT_FLAG = "la-lista-announcement-dismissals-imported";

function readLegacyDismissals(): string[] {
	if (typeof window === "undefined") return [];
	try {
		if (localStorage.getItem(LEGACY_IMPORT_FLAG) === "true") return [];
		return LEGACY_DISMISSAL_KEYS.filter(
			(key) => localStorage.getItem(`dismissed_announcement_${key}`) === "true",
		);
	} catch {
		return [];
	}
}

function markLegacyImported(): void {
	try {
		localStorage.setItem(LEGACY_IMPORT_FLAG, "true");
		for (const key of LEGACY_DISMISSAL_KEYS) {
			localStorage.removeItem(`dismissed_announcement_${key}`);
		}
	} catch {
		// Private mode: the import simply runs again next time.
	}
}

export function AnnouncementBanner() {
	const t = useTranslations();
	const locale = useLocale();
	const { teamSlug } = usePRReview();

	const announcements = useQuery(api.announcements.listForMe, { teamSlug });
	const dismiss = useMutation(api.announcements.dismiss);
	const importLegacyDismissals = useMutation(
		api.announcements.importLegacyDismissals,
	);

	// Dismissals live in Convex now, so they sync across devices. This set only
	// covers the gap between the click and the query updating.
	const [optimisticDismissed, setOptimisticDismissed] = useState<Set<string>>(
		new Set(),
	);

	useEffect(() => {
		const legacy = readLegacyDismissals();
		if (legacy.length === 0) {
			markLegacyImported();
			return;
		}
		void importLegacyDismissals({ keys: legacy })
			.then(() => markLegacyImported())
			.catch((error) => console.error(error));
	}, [importLegacyDismissals]);

	const handleDismiss = async (key: string) => {
		setOptimisticDismissed((prev) => new Set([...prev, key]));
		try {
			await dismiss({ key });
		} catch (error) {
			console.error(error);
			setOptimisticDismissed((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		}
	};

	if (announcements === undefined) return null;

	const visible = announcements.filter(
		(announcement) => !optimisticDismissed.has(announcement.key),
	);
	if (visible.length === 0) return null;

	return visible.map((announcement) => {
		const body = announcement.translationKey
			? null
			: resolveAnnouncementBody(announcement, locale);
		const linkLabel =
			locale === "en"
				? (announcement.linkLabelEn ?? announcement.linkLabelEs)
				: (announcement.linkLabelEs ?? announcement.linkLabelEn);

		return (
			<Alert
				key={announcement._id}
				role="status"
				data-notice
				variant={announcement.variant}
				className="flex min-h-11 items-center gap-2.5 rounded-xl border-border/70 bg-background/72 py-2.5 pr-12 shadow-none"
			>
				<Info className="shrink-0 text-muted-foreground" aria-hidden="true" />
				<AlertTitle className="sr-only">{t("common.info")}</AlertTitle>
				<AlertDescription className="text-pretty text-xs sm:text-sm">
					{announcement.translationKey ? (
						// Built-in banners keep their rich-text chunks from messages/*.json.
						announcement.linkUrl ? (
							t.rich(announcement.translationKey, {
								channel: (chunks) => (
									<a
										href={announcement.linkUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										{chunks}
									</a>
								),
							})
						) : (
							t(announcement.translationKey)
						)
					) : (
						<>
							{body}
							{announcement.linkUrl ? (
								<>
									{" "}
									<a
										href={announcement.linkUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										{linkLabel ?? announcement.linkUrl}
									</a>
								</>
							) : null}
						</>
					)}
				</AlertDescription>
				{announcement.dismissible ? (
					<AlertAction>
						<WithTooltip label={t("announcements.dismiss")}>
							<Button
								variant="ghost"
								size="icon"
								className="size-8"
								onClick={() => void handleDismiss(announcement.key)}
								aria-label={t("announcements.dismiss")}
							>
								<X aria-hidden="true" />
							</Button>
						</WithTooltip>
					</AlertAction>
				) : null}
			</Alert>
		);
	});
}
