"use client";

import {
	Clock,
	Eye,
	LayoutGrid,
	Mail,
	RefreshCw,
	Settings,
	Tags,
	Webhook,
} from "lucide-react";
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
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

import { TeamSettingsDialog } from "./dialogs/TeamSettingsDialog";
import { usePRReview } from "./PRReviewContext";

type OptionToggleProps = {
	id: string;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	description?: string;
	checked: boolean;
	onCheckedChange: (value: boolean) => void;
};

function OptionToggle({
	id,
	icon: Icon,
	label,
	description,
	checked,
	onCheckedChange,
}: OptionToggleProps) {
	return (
		<label
			htmlFor={id}
			className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/30"
		>
			<div className="flex items-center gap-3">
				<span className="flex h-9 w-9 items-center justify-center rounded-md border border-border/50 bg-background text-muted-foreground">
					<Icon className="h-4 w-4" />
				</span>
				<div className="flex flex-col">
					<span className="text-sm font-medium leading-none">{label}</span>
					{description ? (
						<span className="text-xs text-muted-foreground leading-tight">
							{description}
						</span>
					) : null}
				</div>
			</div>
			<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
		</label>
	);
}

export function HeaderOptionsDrawer() {
	const t = useTranslations();
	const isMobile = useIsMobile();
	const [open, setOpen] = React.useState(false);
	const {
		teamSlug,
		compactLayout,
		showAssignments,
		showTags,
		showEmails,
		isRefreshing,
		toggleCompactLayout,
		toggleShowAssignments,
		toggleShowTags,
		toggleShowEmails,
		openSnapshotDialog,
		handleManualRefresh,
		formatLastUpdated,
	} = usePRReview();

	const compactToggleId = React.useId();
	const assignmentsToggleId = React.useId();
	const tagsToggleId = React.useId();
	const emailsToggleId = React.useId();

	const bodyContent = (
		<>
			<div className="px-4 pb-4 space-y-6">
				{/* Language Section */}
				<div>
					<h3 className="text-sm font-medium mb-3">{t("common.language")}</h3>
					<LanguageSwitcher />
				</div>

				<Separator />

				{/* View Options */}
				<div>
					<h3 className="text-sm font-medium mb-3">
						{t("common.viewOptions")}
					</h3>
					<div className="space-y-2">
						<OptionToggle
							id={compactToggleId}
							icon={LayoutGrid}
							label={t("common.compactView")}
							checked={compactLayout}
							onCheckedChange={toggleCompactLayout}
						/>
						<OptionToggle
							id={assignmentsToggleId}
							icon={Eye}
							label={t("pr.showAssignments")}
							checked={showAssignments}
							onCheckedChange={toggleShowAssignments}
						/>
						<OptionToggle
							id={tagsToggleId}
							icon={Tags}
							label={t("pr.showTags")}
							checked={showTags}
							onCheckedChange={toggleShowTags}
						/>
						<OptionToggle
							id={emailsToggleId}
							icon={Mail}
							label={t("pr.showEmails")}
							checked={showEmails}
							onCheckedChange={toggleShowEmails}
						/>
					</div>
				</div>

				<Separator />

				{/* History & Data */}
				<div>
					<h3 className="text-sm font-medium mb-3">
						{t("common.historyAndData")}
					</h3>
					<div className="space-y-2">
						<Button
							variant="outline"
							size="sm"
							className="w-full justify-start"
							onClick={openSnapshotDialog}
						>
							<Clock className="h-4 w-4 mr-2" />
							{t("pr.history")}
						</Button>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="w-full justify-start"
										onClick={handleManualRefresh}
										disabled={isRefreshing}
									>
										<RefreshCw
											className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
										/>
										{t("common.refresh")}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>
										{t("last-updated")} {formatLastUpdated()}
									</p>
									<p className="text-xs text-muted-foreground">
										{t("updates-automatically-every-minute-when-tab-is-active")}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
				</div>

				<Separator />

				{/* Team Settings */}
				<div>
					<h3 className="text-sm font-medium mb-3">
						{t("teamSettings.title")}
					</h3>
					<div className="space-y-2">
						<TeamSettingsDialog
							teamSlug={teamSlug}
							trigger={
								<Button
									variant="outline"
									size="sm"
									className="w-full justify-start"
								>
									<Webhook className="h-4 w-4 mr-2" />
									{t("teamSettings.webhookUrlLabel")}
								</Button>
							}
						/>
					</div>
				</div>

				<Separator />

				{/* Help */}
				<div>
					<h3 className="text-sm font-medium mb-3">{t("common.help")}</h3>
					<KeyboardShortcutsHelp />
				</div>
			</div>
		</>
	);

	const footerAction = (
		<Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
			{t("common.close")}
		</Button>
	);

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={setOpen}>
				<DrawerTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="flex items-center gap-1"
					>
						<Settings className="h-4 w-4" />
						<span className="hidden sm:inline">{t("common.options")}</span>
					</Button>
				</DrawerTrigger>
				<DrawerContent>
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
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="flex items-center gap-1">
					<Settings className="h-4 w-4" />
					<span className="hidden sm:inline">{t("common.options")}</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] overflow-y-auto p-0 sm:max-w-xl">
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
	);
}
