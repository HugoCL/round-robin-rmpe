"use client";

import { useTranslations } from "next-intl";
import {
	Clock,
	Eye,
	EyeOff,
	LayoutGrid,
	Mail,
	RefreshCw,
	Settings,
	Tags,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { KeyboardShortcutsHelp } from "@/components/pr-review/KeyboardShortcutsHelp";
import { Button } from "@/components/ui/button";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

import { usePRReview } from "./PRReviewContext";

export function HeaderOptionsDrawer() {
	const t = useTranslations();
	const {
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

	return (
		<Drawer>
			<DrawerTrigger asChild>
				<Button variant="outline" size="sm" className="flex items-center gap-1">
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
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start"
								onClick={toggleCompactLayout}
							>
								<LayoutGrid className="h-4 w-4 mr-2" />
								{compactLayout
									? t("common.classicView")
									: t("common.compactView")}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start"
								onClick={toggleShowAssignments}
							>
								{showAssignments ? (
									<>
										<EyeOff className="h-4 w-4 mr-2" />
										{t("pr.hideAssignments")}
									</>
								) : (
									<>
										<Eye className="h-4 w-4 mr-2" />
										{t("pr.showAssignments")}
									</>
								)}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start"
								onClick={toggleShowTags}
							>
								{showTags ? (
									<>
										<EyeOff className="h-4 w-4 mr-2" />
										{t("pr.hideTags")}
									</>
								) : (
									<>
										<Tags className="h-4 w-4 mr-2" />
										{t("pr.showTags")}
									</>
								)}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start"
								onClick={toggleShowEmails}
							>
								{showEmails ? (
									<>
										<EyeOff className="h-4 w-4 mr-2" />
										{t("pr.hideEmails")}
									</>
								) : (
									<>
										<Mail className="h-4 w-4 mr-2" />
										{t("pr.showEmails")}
									</>
								)}
							</Button>
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
										<p>Last updated: {formatLastUpdated()}</p>
										<p className="text-xs text-muted-foreground">
											Updates automatically every minute
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>

					<Separator />

					{/* Help */}
					<div>
						<h3 className="text-sm font-medium mb-3">{t("common.help")}</h3>
						<KeyboardShortcutsHelp />
					</div>
				</div>
				<DrawerFooter>
					<DrawerClose asChild>
						<Button variant="outline">{t("common.close")}</Button>
					</DrawerClose>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
