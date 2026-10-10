"use client";

import {
	Bot,
	CalendarPlus,
	ClipboardList,
	Keyboard,
	Lightbulb,
	Menu,
	Settings,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useFeatureEnabled } from "@/components/AppConfigProvider";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { openAgentSetupDialog } from "@/lib/agent-setup-dialog-store";
import { ChangelogDialog } from "../ChangelogDialog";
import { CreateEventDialog } from "../dialogs/CreateEventDialog";
import { HeaderOptionsDrawer } from "../HeaderOptionsDrawer";
import { KeyboardShortcutsHelp } from "../KeyboardShortcutsHelp";
import { usePRReview } from "../PRReviewContext";

type MenuDialog = "options" | "event" | "changelog" | "shortcuts";

function PushNotificationsItem({
	push: { status, isLoading, subscribe, unsubscribe },
}: {
	push: ReturnType<typeof usePushNotifications>;
}) {
	const t = useTranslations("notifications");

	return (
		<DropdownMenuCheckboxItem
			checked={status === "subscribed"}
			disabled={isLoading || status === "denied"}
			onSelect={(event) => event.preventDefault()}
			onCheckedChange={(checked) =>
				void (checked ? subscribe() : unsubscribe())
			}
		>
			{status === "denied" ? t("blocked") : t("label")}
		</DropdownMenuCheckboxItem>
	);
}

/**
 * Everything the header used to show as a row of icons, behind one menu: none
 * of it is part of assigning a PR, so it should not compete with it.
 */
export function HeaderMenu() {
	const t = useTranslations();
	const locale = useLocale();
	const { isAdmin, canManageCurrentTeam, userInfo } = usePRReview();
	const eventsEnabled = useFeatureEnabled("events");
	const surveysEnabled = useFeatureEnabled("surveys");
	const suggestionsEnabled = useFeatureEnabled("suggestionsBoard");
	const pushEnabled = useFeatureEnabled("pushNotifications");
	const [dialog, setDialog] = useState<MenuDialog | null>(null);
	// Not in the menu item: closed menu content unmounts, and the hook must run on
	// load to register the service worker and clear Firefox's stale notifications.
	const push = usePushNotifications({
		userEmail: userInfo?.email ?? "",
		enabled: Boolean(userInfo?.email) && pushEnabled,
	});

	const dialogProps = (name: MenuDialog) => ({
		open: dialog === name,
		onOpenChange: (open: boolean) => setDialog(open ? name : null),
	});

	return (
		<>
			{/* Non-modal: a modal menu that opens a dialog can leave the page with
			    `pointer-events: none` after both close. */}
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<IconActionButton label={t("common.menu")} className="relative">
						<Menu />
					</IconActionButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuGroup>
						<DropdownMenuLabel>{t("headerMenu.team")}</DropdownMenuLabel>
						{canManageCurrentTeam && eventsEnabled ? (
							<DropdownMenuItem onSelect={() => setDialog("event")}>
								<CalendarPlus />
								{t("events.createEvent")}
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem onSelect={() => setDialog("options")}>
							<Settings />
							{t("common.options")}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => openAgentSetupDialog()}>
							<Bot />
							{t("agentSetup.navbarLabel")}
						</DropdownMenuItem>
					</DropdownMenuGroup>

					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel>{t("headerMenu.help")}</DropdownMenuLabel>
						<DropdownMenuItem onSelect={() => setDialog("changelog")}>
							<Sparkles />
							{t("changelog.title")}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setDialog("shortcuts")}>
							<Keyboard />
							{t("shortcuts.help")}
						</DropdownMenuItem>
						{suggestionsEnabled ? (
							<DropdownMenuItem asChild>
								<Link href={`/${locale}/suggestions`}>
									<Lightbulb />
									{t("suggestions.shortcut")}
								</Link>
							</DropdownMenuItem>
						) : null}
					</DropdownMenuGroup>

					{isAdmin ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuLabel>{t("headerMenu.admin")}</DropdownMenuLabel>
								{surveysEnabled ? (
									<DropdownMenuItem asChild>
										<Link href={`/${locale}/surveys`}>
											<ClipboardList />
											{t("survey.shortcut")}
										</Link>
									</DropdownMenuItem>
								) : null}
								<DropdownMenuItem asChild>
									<Link href={`/${locale}/admin`}>
										<ShieldCheck />
										{t("admin.shortcut")}
									</Link>
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</>
					) : null}

					{userInfo?.email && pushEnabled && push.isSupported ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuLabel>
									{t("headerMenu.preferences")}
								</DropdownMenuLabel>
								<PushNotificationsItem push={push} />
							</DropdownMenuGroup>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Rendered outside the menu so closing it does not unmount them. */}
			<HeaderOptionsDrawer {...dialogProps("options")} />
			<ChangelogDialog {...dialogProps("changelog")} />
			<KeyboardShortcutsHelp {...dialogProps("shortcuts")} />
			{canManageCurrentTeam && eventsEnabled ? (
				<CreateEventDialog {...dialogProps("event")} />
			) : null}
		</>
	);
}
