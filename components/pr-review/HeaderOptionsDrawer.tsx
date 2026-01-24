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

type OptionTone = "layout" | "visibility" | "tags" | "email";

type OptionToggleProps = {
	id: string;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	description?: string;
	checked: boolean;
	onCheckedChange: (value: boolean) => void;
	tone?: OptionTone;
};

function OptionToggle(props: OptionToggleProps) {
	const {
		id,
		icon: Icon,
		label,
		description,
		checked,
		onCheckedChange,
		tone = "layout",
	} = props;

	const toneKey: OptionTone = tone ?? "layout";
	const toneClasses: Record<OptionTone, string> = {
		layout:
			"border-blue-200/80 bg-blue-50/70 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/30 dark:text-blue-100",
		visibility:
			"border-emerald-200/80 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-100",
		tags: "border-amber-200/80 bg-amber-50/70 text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-100",
		email:
			"border-indigo-200/80 bg-indigo-50/70 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-900/30 dark:text-indigo-100",
	};

	return (
		<label
			htmlFor={id}
			className={`flex items-start justify-between gap-3  border px-3 py-2 transition-all hover:-translate-y-[1px] hover:shadow-sm ${toneClasses[toneKey]}`}
		>
			<div className="flex items-center gap-3">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center  bg-white/70 text-current shadow-sm dark:bg-white/10">
					<Icon className="h-4 w-4" aria-hidden />
				</span>
				<div className="flex flex-col">
					<span className="text-sm font-semibold leading-none">{label}</span>
					{description ? (
						<span className="text-xs text-muted-foreground leading-tight">
							{description}
						</span>
					) : null}
				</div>
			</div>
			<Switch
				id={id}
				checked={checked}
				onCheckedChange={onCheckedChange}
				className="mt-1"
			/>
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
		<div className="px-4 pb-5">
			<div className=" bg-white/92 shadow-xl ring-1 ring-border/70 backdrop-blur dark:bg-slate-900/75 dark:ring-white/10">
				<div className="p-4 space-y-6">
					<div className="space-y-3">
						<h3 className="text-sm font-semibold flex items-center gap-2">
							<LayoutGrid className="h-4 w-4 text-primary" />
							{t("common.viewOptions")}
						</h3>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<OptionToggle
								id={compactToggleId}
								icon={LayoutGrid}
								label={t("common.compactView")}
								description={t("common.compactViewDescription")}
								checked={compactLayout}
								onCheckedChange={toggleCompactLayout}
								tone="layout"
							/>
							<OptionToggle
								id={assignmentsToggleId}
								icon={Eye}
								label={t("pr.showAssignments")}
								description={t("pr.showAssignmentsDescription")}
								checked={showAssignments}
								onCheckedChange={toggleShowAssignments}
								tone="visibility"
							/>
							<OptionToggle
								id={tagsToggleId}
								icon={Tags}
								label={t("pr.showTags")}
								description={t("pr.showTagsDescription")}
								checked={showTags}
								onCheckedChange={toggleShowTags}
								tone="tags"
							/>
							<OptionToggle
								id={emailsToggleId}
								icon={Mail}
								label={t("pr.showEmails")}
								description={t("pr.showEmailsDescription")}
								checked={showEmails}
								onCheckedChange={toggleShowEmails}
								tone="email"
							/>
						</div>
					</div>

					<Separator />

					<div className="grid sm:grid-cols-2 gap-4 items-start">
						<div className="space-y-3">
							<h3 className="text-sm font-semibold flex items-center gap-2">
								<Clock className="h-4 w-4 text-primary" />
								{t("common.historyAndData")}
							</h3>
							<div className="space-y-2">
								<Button
									variant="outline"
									size="sm"
									className="w-full justify-start  min-h-[46px]"
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
												className="w-full justify-start min-h-11.5"
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
												{t(
													"updates-automatically-every-minute-when-tab-is-active",
												)}
											</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
						</div>

						<div className="space-y-3">
							<h3 className="text-sm font-semibold flex items-center gap-2">
								<Webhook className="h-4 w-4 text-primary" />
								{t("teamSettings.title")}
							</h3>
							<TeamSettingsDialog
								teamSlug={teamSlug}
								trigger={
									<Button
										variant="outline"
										size="sm"
										className="w-full justify-start  min-h-[46px] text-left leading-tight whitespace-normal"
									>
										<Webhook className="h-4 w-4 mr-2" />
										{t("teamSettings.webhookUrlLabel")}
									</Button>
								}
							/>
						</div>
					</div>

					<Separator />

					<div className="space-y-3">
						<h3 className="text-sm font-semibold flex items-center gap-2">
							<Eye className="h-4 w-4 text-primary" />
							{t("common.language")}
						</h3>
						<LanguageSwitcher />
					</div>

					<div className="pt-2">
						<h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
							<Settings className="h-4 w-4 text-primary" />
							{t("common.help")}
						</h3>
						<KeyboardShortcutsHelp />
					</div>
				</div>
			</div>
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
			</>
		);
	}

	return (
		<>
			{triggerButton}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto p-0 sm:max-w-3xl">
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
