"use client";

import { useQuery } from "convex/react";
import { Bot, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert, AlertAction } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { openAgentSetupDialog } from "@/lib/agent-setup-dialog-store";

const STORAGE_KEY = "dismissed_announcement_mcp-ga-v1";

export function isMcpLaunchDismissed() {
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
		setDismissed(isMcpLaunchDismissed());
		setMounted(true);
	}, []);

	if (!mounted || tokens === undefined || dismissed) return null;

	const hasActiveToken = tokens.some((token) => !token.revokedAt);
	if (hasActiveToken) return null;

	const handleDismiss = () => {
		writeDismissed();
		setDismissed(true);
	};

	// A notice row like the others in the stack: it should not outrank the task.
	return (
		<Alert
			data-notice
			// Not live: it is there on load and should not be announced each time.
			role={undefined}
			className="flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border-border/70 bg-background/72 py-2.5 pr-12 shadow-none"
		>
			<Bot
				className="mt-0.5 shrink-0 self-start text-muted-foreground"
				aria-hidden="true"
			/>
			<div className="flex min-w-0 flex-1 basis-60 flex-wrap items-center gap-x-2 gap-y-0.5">
				<span className="text-sm font-medium">
					{t("title")}
					<Badge
						variant="secondary"
						className="ml-1.5 h-5 px-1.5 align-middle text-[11px]"
					>
						{t("kicker")}
					</Badge>
				</span>
				<span className="basis-full text-xs text-muted-foreground sm:text-sm">
					{t("description")}
				</span>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="rounded-full"
				onClick={() => openAgentSetupDialog()}
			>
				{t("configure")}
			</Button>
			<AlertAction>
				<WithTooltip label={t("dismiss")}>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8"
						onClick={handleDismiss}
						aria-label={t("dismiss")}
					>
						<X aria-hidden="true" />
					</Button>
				</WithTooltip>
			</AlertAction>
		</Alert>
	);
}
