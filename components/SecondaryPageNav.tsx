"use client";

import { ArrowLeft, List } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * Slim top bar for pages outside the team board (metrics, suggestions, surveys,
 * team creation). Those pages are reached from the board's header and used to
 * offer no way back other than the browser's back button.
 */
export function SecondaryPageNav() {
	const locale = useLocale();
	const t = useTranslations();
	const [lastTeam, setLastTeam] = useState<string | null>(null);

	useEffect(() => {
		try {
			setLastTeam(window.localStorage.getItem("la-lista-last-team"));
		} catch {
			// Private mode or blocked storage: the home link still works.
		}
	}, []);

	const backHref = lastTeam ? `/${locale}/${lastTeam}` : `/${locale}`;
	const backLabel = lastTeam ? lastTeam : t("team.backHome");

	return (
		<header className="border-b border-border/60 bg-background/95 backdrop-blur-sm">
			<div className="mx-auto flex w-full max-w-screen-2xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
				<Link
					href={`/${locale}`}
					className="flex items-center gap-2 rounded-full text-sm font-semibold tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<List className="size-4" aria-hidden="true" />
					</span>
					La Lista
				</Link>
				<Link
					href={backHref}
					className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3.5 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<ArrowLeft className="size-4" aria-hidden="true" />
					<span className="max-w-[12rem] truncate">{backLabel}</span>
				</Link>
			</div>
		</header>
	);
}
