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
		id: "classic-view-deprecation",
		translationKey: "announcements.classicViewDeprecation",
		variant: "default",
	},
];

function getStorageKey(id: string): string {
	return `dismissed_announcement_${id}`;
}

function isDismissed(id: string): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(getStorageKey(id)) === "true";
}

function dismissAnnouncement(id: string): void {
	localStorage.setItem(getStorageKey(id), "true");
}

/**
 * AnnouncementBanner displays important announcements to users.
 * Announcements can be permanently dismissed and the dismissal is stored in localStorage.
 */
export function AnnouncementBanner() {
	const t = useTranslations();
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
	const [mounted, setMounted] = useState(false);

	// Load dismissed state from localStorage on mount
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

	// Don't render anything until mounted (to avoid SSR hydration issues)
	if (!mounted) return null;

	const visibleAnnouncements = ANNOUNCEMENTS.filter(
		(a) => !dismissedIds.has(a.id),
	);

	if (visibleAnnouncements.length === 0) return null;

	return (
		<div className="space-y-2">
			{visibleAnnouncements.map((announcement) => (
				<Alert key={announcement.id} variant={announcement.variant}>
					<Info className="h-4 w-4" />
					<AlertTitle>{t("common.info")}</AlertTitle>
					<AlertDescription>{t(announcement.translationKey)}</AlertDescription>
					<AlertAction>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={() => handleDismiss(announcement.id)}
							aria-label={t("announcements.dismiss")}
						>
							<X className="h-4 w-4" />
						</Button>
					</AlertAction>
				</Alert>
			))}
		</div>
	);
}
