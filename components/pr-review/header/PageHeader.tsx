import { Bot, ClipboardList, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
	openAgentSetupDialog,
	useAgentSetupDialogOpen,
} from "@/lib/agent-setup-dialog-store";
import { ChangelogDialog } from "../ChangelogDialog";
import { CreateEventDialog } from "../dialogs/CreateEventDialog";
import { HeaderOptionsDrawer } from "../HeaderOptionsDrawer";
import { usePRReview } from "../PRReviewContext";
import { HeaderStatusBar } from "./HeaderStatusBar";
import { TeamWeeklyPRCounter } from "./TeamWeeklyPRCounter";

interface PageHeaderProps {
	teamSlug?: string;
}

/**
 * PageHeader component displays the main title, team switcher, and action buttons.
 */
export function PageHeader({ teamSlug }: PageHeaderProps) {
	const t = useTranslations();
	const { isAdmin, isForeignTeamView, canManageCurrentTeam, userInfo } =
		usePRReview();
	const locale = useLocale();
	const agentSetupOpen = useAgentSetupDialogOpen();

	return (
		<header className="sticky top-0 z-40">
			<div className="bg-background/95 py-4 backdrop-blur-sm">
				<div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
					<div className="flex flex-wrap items-center gap-2 sm:gap-3">
						<div className="mr-auto flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
							<h1 className="shrink-0 text-xl font-semibold tracking-tight sm:text-2xl">
								La Lista
							</h1>
							<div className="min-w-0 flex-1 sm:flex-none [&_[data-slot=select-trigger]]:h-9 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:rounded-xl sm:[&_[data-slot=select-trigger]]:w-[min(13rem,48vw)]">
								<TeamSwitcher teamSlug={teamSlug} />
							</div>
							<TeamWeeklyPRCounter teamSlug={teamSlug} />
						</div>
						<nav
							className="flex w-full flex-wrap items-center justify-end gap-0.5 sm:w-auto sm:flex-nowrap"
							aria-label={t("common.options")}
						>
							<IconActionButton
								accent
								label={t("agentSetup.navbarLabel")}
								tooltip={t("agentSetup.navbarTooltip")}
								aria-expanded={agentSetupOpen}
								aria-haspopup="dialog"
								onClick={() => openAgentSetupDialog()}
							>
								<Bot />
							</IconActionButton>
							<IconActionButton asChild label={t("suggestions.shortcut")}>
								<Link href={`/${locale}/suggestions`}>
									<Lightbulb />
								</Link>
							</IconActionButton>
							{isAdmin ? (
								<IconActionButton asChild label={t("survey.shortcut")}>
									<Link href={`/${locale}/surveys`}>
										<ClipboardList />
									</Link>
								</IconActionButton>
							) : null}
							{canManageCurrentTeam ? <CreateEventDialog iconOnly /> : null}
							<ChangelogDialog iconOnly />
							{userInfo?.email && (
								<PushNotificationManager userEmail={userInfo.email} iconOnly />
							)}
							<ThemeToggle />
							<HeaderOptionsDrawer />
						</nav>
						{isForeignTeamView ? (
							<p className="basis-full truncate text-xs text-muted-foreground">
								{t("team.foreignTeamReadonlyBanner")}
							</p>
						) : null}
					</div>
				</div>
			</div>
			<div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
				<HeaderStatusBar />
			</div>
		</header>
	);
}
