"use client";

import { Clock, Eye, Settings, Webhook } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { KeyboardShortcutsHelp } from "@/components/pr-review/KeyboardShortcutsHelp";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

import { TeamSettingsDialog } from "./dialogs/TeamSettingsDialog";
import { usePRReview } from "./PRReviewContext";

export function HeaderOptionsDrawer() {
	const t = useTranslations();
	const isMobile = useIsMobile();
	const [open, setOpen] = React.useState(false);
	const { teamSlug, openSnapshotDialog } = usePRReview();

	const bodyContent = (
		<div className="space-y-4 px-4 pb-5">
			<section className="rounded-xl border border-border bg-card p-4 shadow-sm">
				<div className="grid items-start gap-4 sm:grid-cols-2">
					<div className="space-y-3">
						<h3 className="flex items-center gap-2 text-sm font-semibold">
							<Clock className="h-4 w-4 text-primary" />
							{t("common.historyAndData")}
						</h3>
						<Button
							variant="outline"
							size="sm"
							className="min-h-[46px] w-full justify-start"
							onClick={openSnapshotDialog}
						>
							<Clock className="mr-2 h-4 w-4" />
							{t("pr.history")}
						</Button>
					</div>

					<div className="space-y-3">
						<h3 className="flex items-center gap-2 text-sm font-semibold">
							<Webhook className="h-4 w-4 text-primary" />
							{t("teamSettings.title")}
						</h3>
						<TeamSettingsDialog
							teamSlug={teamSlug}
							trigger={
								<Button
									variant="outline"
									size="sm"
									className="min-h-[46px] w-full justify-start whitespace-normal text-left leading-tight"
								>
									<Webhook className="mr-2 h-4 w-4" />
									{t("teamSettings.webhookUrlLabel")}
								</Button>
							}
						/>
					</div>
				</div>
			</section>

			<section className="rounded-xl border border-border bg-card p-4 shadow-sm">
				<div className="space-y-4">
					<div className="space-y-3">
						<h3 className="flex items-center gap-2 text-sm font-semibold">
							<Eye className="h-4 w-4 text-primary" />
							{t("common.language")}
						</h3>
						<LanguageSwitcher />
					</div>

					<Separator />

					<div className="space-y-3">
						<h3 className="flex items-center gap-2 text-sm font-semibold">
							<Settings className="h-4 w-4 text-primary" />
							{t("common.help")}
						</h3>
						<KeyboardShortcutsHelp />
					</div>
				</div>
			</section>
		</div>
	);

	const footerAction = (
		<Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
			{t("common.close")}
		</Button>
	);

	const triggerButton = (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label={t("common.options")}
						onClick={() => setOpen(true)}
					>
						<Settings className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{t("common.options")}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);

	if (isMobile) {
		return (
			<>
				{triggerButton}
				<Drawer open={open} onOpenChange={setOpen}>
					<DrawerContent className="max-h-[90vh] overflow-y-auto overscroll-contain">
						<DrawerHeader>
							<DrawerTitle>{t("common.options")}</DrawerTitle>
							<DrawerDescription>
								{t("common.optionsDescription")}
							</DrawerDescription>
						</DrawerHeader>
						{bodyContent}
						<DrawerFooter>
							<DrawerClose asChild>{footerAction}</DrawerClose>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
			</>
		);
	}

	return (
		<>
			{triggerButton}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto overscroll-contain p-0 sm:max-w-3xl">
					<div className="px-4 pt-4">
						<DialogHeader>
							<DialogTitle>{t("common.options")}</DialogTitle>
							<DialogDescription>
								{t("common.optionsDescription")}
							</DialogDescription>
						</DialogHeader>
					</div>
					{bodyContent}
					<DialogFooter className="px-4 pb-4">
						<DialogClose asChild>{footerAction}</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
