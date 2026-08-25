"use client";

import { useQuery } from "convex/react";
import { ChevronDown, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { WithTooltip } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { usePRReview } from "./PRReviewContext";

interface Announcement {
	id: string;
	translationKey: string;
	variant?: "default" | "destructive";
	requiresTeamEvents?: boolean;
	href?: string;
}

const COORD_LA_LISTA_CHAT_URL =
	"https://chat.google.com/room/AAQA237JK9g?cls=7";

const ANNOUNCEMENTS: Announcement[] = [
	{
		id: "coord-la-lista-v1",
		translationKey: "announcements.coordChannel",
		variant: "default",
		href: COORD_LA_LISTA_CHAT_URL,
	},
	{
		id: "create-event-navbar-v1",
		translationKey: "announcements.createEventMoved",
		variant: "default",
		requiresTeamEvents: true,
	},
	{
		id: "reviewers-panel-v1",
		translationKey: "announcements.reviewersPanelMoved",
		variant: "default",
	},
	{
		id: "mcp-setup-wizard-v1",
		translationKey: "announcements.mcpSetupWizard",
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
	const { teamSlug } = usePRReview();
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
	const [mounted, setMounted] = useState(false);
	const teamHasEvents = useQuery(
		api.queries.teamHasEvents,
		teamSlug ? { teamSlug } : "skip",
	);

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

	const visibleAnnouncements = ANNOUNCEMENTS.filter((announcement) => {
		if (dismissedIds.has(announcement.id)) {
			return false;
		}
		if (announcement.requiresTeamEvents) {
			return teamHasEvents === true;
		}
		return true;
	});

	if (visibleAnnouncements.length === 0) return null;

	const grouped = visibleAnnouncements.length > 1;

	const alerts = visibleAnnouncements.map((announcement) => (
		<Alert
			key={announcement.id}
			data-notice={grouped ? undefined : true}
			variant={announcement.variant}
			className={cn(
				"flex min-h-11 items-center gap-2.5 py-2.5 pr-12 shadow-none",
				grouped
					? "rounded-none border-0 bg-transparent"
					: "rounded-xl border-border/70 bg-background/72",
			)}
		>
			<Info className="shrink-0 text-muted-foreground" aria-hidden="true" />
			<AlertTitle className="sr-only">{t("common.info")}</AlertTitle>
			<AlertDescription className="text-pretty text-xs sm:text-sm">
				{announcement.href
					? t.rich(announcement.translationKey, {
							channel: (chunks) => (
								<a
									href={announcement.href}
									target="_blank"
									rel="noopener noreferrer"
								>
									{chunks}
								</a>
							),
						})
					: t(announcement.translationKey)}
			</AlertDescription>
			<AlertAction>
				<WithTooltip label={t("announcements.dismiss")}>
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						onClick={() => handleDismiss(announcement.id)}
						aria-label={t("announcements.dismiss")}
					>
						<X aria-hidden="true" />
					</Button>
				</WithTooltip>
			</AlertAction>
		</Alert>
	));

	if (!grouped) {
		return alerts;
	}

	return (
		<Collapsible
			defaultOpen={window.innerWidth >= 640}
			className="group/avisos calm-panel p-2"
		>
			<CollapsibleTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					className="h-10 w-full justify-start rounded-xl px-2"
				>
					<Info aria-hidden="true" />
					<span>{t("announcements.title")}</span>
					<Badge variant="secondary" className="ml-auto">
						{visibleAnnouncements.length}
					</Badge>
					<ChevronDown
						className="transition-transform duration-200 motion-reduce:transition-none group-data-[state=open]/avisos:rotate-180"
						aria-hidden="true"
					/>
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent className="divide-y divide-border/60 pt-1">
				{alerts}
			</CollapsibleContent>
		</Collapsible>
	);
}
