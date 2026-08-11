"use client";

import { Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Announcement {
	id: string;
	translationKey: string;
	variant?: "default" | "destructive";
}

const ANNOUNCEMENTS: Announcement[] = [
	{
		id: "suggestions-board-invite-v1",
		translationKey: "announcements.suggestionsBoardInvite",
		variant: "default",
	},
];

function getStorageKey(id: string): string {
	return `dismissed_announcement_${id}`;
}

function isDismissed(id: string): boolean {
	if (typeof window === "undefined") return false;
	try {
		return localStorage.getItem(getStorageKey(id)) === "true";
	} catch {
		return false;
	}
}

function dismissAnnouncement(id: string): void {
	try {
		localStorage.setItem(getStorageKey(id), "true");
	} catch {
		// no-op
	}
}

export function AnnouncementBanner() {
	const t = useTranslations();
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const dismissed = new Set<string>();
		for (const announcement of ANNOUNCEMENTS) {
			if (isDismissed(announcement.id)) {
				dismissed.add(announcement.id);
			}
		}
		setDismissedIds(dismissed);
		setMounted(true);
	}, []);

	const handleDismiss = (id: string) => {
		dismissAnnouncement(id);
		setDismissedIds((prev) => new Set([...prev, id]));
	};

	if (!mounted) return null;

	const visibleAnnouncements = ANNOUNCEMENTS.filter(
		(announcement) => !dismissedIds.has(announcement.id),
	);

	if (visibleAnnouncements.length === 0) return null;

	return (
		<>
			{visibleAnnouncements.map((announcement) => (
				<Alert
					key={announcement.id}
					data-notice
					variant={announcement.variant}
					className="flex min-h-11 items-center gap-2.5 rounded-xl border-border/70 bg-background/72 py-2.5 pr-12 shadow-none"
				>
					<Info className="shrink-0 text-muted-foreground" />
					<AlertTitle className="sr-only">{t("common.info")}</AlertTitle>
					<AlertDescription className="line-clamp-2 text-xs sm:text-sm">
						{t(announcement.translationKey)}
					</AlertDescription>
					<AlertAction>
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => handleDismiss(announcement.id)}
							aria-label={t("announcements.dismiss")}
						>
							<X />
						</Button>
					</AlertAction>
				</Alert>
			))}
		</>
	);
}
