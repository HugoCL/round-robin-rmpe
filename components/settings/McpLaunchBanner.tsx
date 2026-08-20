"use client";

import { useQuery } from "convex/react";
import { Bot, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { McpTutorialPlayer } from "@/components/settings/McpTutorialPlayer";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { openAgentSetupDialog } from "@/lib/agent-setup-dialog-store";

const STORAGE_KEY = "dismissed_announcement_mcp-ga-v1";

function readDismissed() {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(STORAGE_KEY) === "true";
	} catch {
		return false;
	}
}

function writeDismissed() {
	try {
		window.localStorage.setItem(STORAGE_KEY, "true");
	} catch {
		// no-op
	}
}

export function McpLaunchBanner() {
	const t = useTranslations("mcpLaunch");
	const tokens = useQuery(api.agent.getMyAgentTokens);
	const [mounted, setMounted] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		setDismissed(readDismissed());
		setMounted(true);
	}, []);

	if (!mounted || tokens === undefined || dismissed) return null;

	const hasActiveToken = tokens.some((token) => !token.revokedAt);
	if (hasActiveToken) return null;

	const handleDismiss = () => {
		writeDismissed();
		setDismissed(true);
	};

	return (
		<section className="calm-section p-4 md:p-5" aria-label={t("title")}>
			<div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] lg:items-start lg:gap-6">
				<div className="min-w-0 space-y-3">
					<p className="calm-kicker">{t("kicker")}</p>
					<div className="flex items-start justify-between gap-3">
						<h2 className="text-lg font-semibold tracking-tight">
							{t("title")}
						</h2>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={handleDismiss}
							aria-label={t("dismiss")}
						>
							<X />
						</Button>
					</div>
					<p className="max-w-prose text-sm text-muted-foreground">
						{t("description")}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<Button type="button" onClick={() => openAgentSetupDialog()}>
							<Bot data-icon="inline-start" />
							{t("configure")}
						</Button>
						<Button type="button" variant="outline" onClick={handleDismiss}>
							{t("later")}
						</Button>
					</div>
				</div>
				<div className="min-w-0">
					<McpTutorialPlayer compact />
				</div>
			</div>
		</section>
	);
}
