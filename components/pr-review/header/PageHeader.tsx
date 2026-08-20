import {
	Bot,
	Calendar,
	ChevronDown,
	ClipboardList,
	Download,
	Lightbulb,
	Menu,
	RotateCw,
	Save,
	SlidersHorizontal,
	UserMinus,
	UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	IconActionButton,
	iconActionButtonClass,
} from "@/components/ui/icon-action-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	openAgentSetupDialog,
	useAgentSetupDialogOpen,
} from "@/lib/agent-setup-dialog-store";
import { cn } from "@/lib/utils";
import { ChangelogDialog } from "../ChangelogDialog";
import { AddReviewerDialog } from "../dialogs/AddReviewerDialog";
import { CreateEventDialog } from "../dialogs/CreateEventDialog";
import { DeleteReviewerDialog } from "../dialogs/DeleteReviewerDialog";
import { HeaderOptionsDrawer } from "../HeaderOptionsDrawer";
import { usePRReview } from "../PRReviewContext";
import { ReviewersTable } from "../ReviewersTable";
import { TagManager } from "../TagManager";
import { TeamWeeklyPRCounter } from "./TeamWeeklyPRCounter";

/** Every control in the collapsible actions row shares this pill treatment. */
const actionPillClass =
	"min-h-11 rounded-full border-border/70 bg-background/70 sm:min-h-8";

interface PageHeaderProps {
	teamSlug?: string;
	reviewersDrawerOpen: boolean;
	setReviewersDrawerOpen: (o: boolean) => void;
}

/**
 * PageHeader component displays the main title, team switcher, and action buttons.
 */
export function PageHeader({
	teamSlug,
	reviewersDrawerOpen,
	setReviewersDrawerOpen,
}: PageHeaderProps) {
	const t = useTranslations();
	const {
		addReviewer,
		removeReviewer,
		reviewers,
		isAdmin,
		isForeignTeamView,
		canManageCurrentTeam,
		showAssignments,
		showTags,
		showEmails,
		toggleShowAssignments,
		toggleShowTags,
		toggleShowEmails,
		handleResetCounts,
		exportData,
		userInfo,
	} = usePRReview();
	const isMobile = useIsMobile();
	const locale = useLocale();
	const agentSetupOpen = useAgentSetupDialogOpen();
	const [actionsOpen, setActionsOpen] = useState(false);
	const visibleColumnsCount = [showAssignments, showTags, showEmails].filter(
		Boolean,
	).length;

	const reviewerActions = canManageCurrentTeam ? (
		<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-start">
			<TagManager />
			<AddReviewerDialog
				onAddReviewer={addReviewer}
				trigger={
					<Button variant="outline" size="sm" className={actionPillClass}>
						<UserPlus data-icon="inline-start" />
						{t("pr.addReviewer")}
					</Button>
				}
			/>
			<CreateEventDialog
				trigger={
					<Button variant="outline" size="sm" className={actionPillClass}>
						<Calendar data-icon="inline-start" />
						{t("events.createEvent")}
					</Button>
				}
			/>
		</div>
	) : null;

	const deleteReviewerButton = canManageCurrentTeam ? (
		<DeleteReviewerDialog
			reviewers={reviewers}
			onDeleteReviewer={removeReviewer}
			trigger={
				<Button variant="outline" size="sm" className={actionPillClass}>
					<UserMinus data-icon="inline-start" />
					<span>{t("pr.deleteReviewer")}</span>
				</Button>
			}
		/>
	) : null;

	const reviewerColumnsButton = (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className={actionPillClass}>
					<SlidersHorizontal data-icon="inline-start" />
					{t("pr.viewColumns")}
					<span className="ml-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
						{visibleColumnsCount}/3
					</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72">
				<DropdownMenuLabel>{t("common.viewOptions")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem
					checked={showAssignments}
					onSelect={(event) => event.preventDefault()}
					onCheckedChange={(checked) => {
						if (checked !== showAssignments) toggleShowAssignments();
					}}
				>
					<div className="flex flex-col gap-1">
						<p>{t("pr.showAssignments")}</p>
						<p className="text-[11px] text-muted-foreground">
							{t("pr.showAssignmentsDescription")}
						</p>
					</div>
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem
					checked={showTags}
					onSelect={(event) => event.preventDefault()}
					onCheckedChange={(checked) => {
						if (checked !== showTags) toggleShowTags();
					}}
				>
					<div className="flex flex-col gap-1">
						<p>{t("pr.showTags")}</p>
						<p className="text-[11px] text-muted-foreground">
							{t("pr.showTagsDescription")}
						</p>
					</div>
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem
					checked={showEmails}
					onSelect={(event) => event.preventDefault()}
					onCheckedChange={(checked) => {
						if (checked !== showEmails) toggleShowEmails();
					}}
				>
					<div className="flex flex-col gap-1">
						<p>{t("pr.showEmails")}</p>
						<p className="text-[11px] text-muted-foreground">
							{t("pr.showEmailsDescription")}
						</p>
					</div>
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	return (
		<header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 py-3 backdrop-blur-sm">
			<Collapsible
				className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8"
				open={actionsOpen}
				onOpenChange={setActionsOpen}
			>
				<div className="flex flex-col gap-2">
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
						<div className="flex w-full flex-wrap items-center justify-end gap-0.5 sm:w-auto sm:flex-nowrap">
							<nav
								className="flex flex-wrap items-center justify-end gap-0.5"
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
								<ChangelogDialog iconOnly />
								{userInfo?.email && (
									<PushNotificationManager
										userEmail={userInfo.email}
										iconOnly
									/>
								)}
								<ThemeToggle />
								<HeaderOptionsDrawer />
							</nav>
							<span
								className="mx-1 h-5 w-px shrink-0 bg-border/70"
								aria-hidden="true"
							/>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<CollapsibleTrigger asChild>
											<Button
												variant="ghost"
												className={cn(iconActionButtonClass, "p-0")}
												aria-label={
													actionsOpen
														? `${t("common.hide")} ${t("pr.actions")}`
														: `${t("common.show")} ${t("pr.actions")}`
												}
											>
												<ChevronDown
													className={cn(
														"h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none",
														actionsOpen && "rotate-180",
													)}
												/>
											</Button>
										</CollapsibleTrigger>
									</TooltipTrigger>
									<TooltipContent>
										<p>{t("pr.actions")}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						{isForeignTeamView ? (
							<p className="basis-full truncate text-xs text-muted-foreground">
								{t("team.foreignTeamReadonlyBanner")}
							</p>
						) : null}
					</div>
					<CollapsibleContent className="border-t border-border/60 pt-2">
						<div className="flex w-full flex-wrap items-center justify-start gap-2 sm:justify-end">
							{!canManageCurrentTeam ? (
								<div className="rounded-full border border-border/70 bg-background/70 px-4 py-2 text-sm text-muted-foreground">
									{isAdmin
										? t("team.foreignTeamAdminBanner")
										: t("team.foreignTeamReadonlyBanner")}
								</div>
							) : (
								<div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
									{reviewerActions}
									{isMobile ? (
										<Drawer
											open={reviewersDrawerOpen}
											onOpenChange={setReviewersDrawerOpen}
										>
											<DrawerTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													className={actionPillClass}
												>
													<Menu data-icon="inline-start" />
													<span>{t("pr.manageReviewers")}</span>
												</Button>
											</DrawerTrigger>
											<DrawerContent className="max-h-[92dvh]">
												<DrawerHeader>
													<DrawerTitle>{t("pr.reviewers")}</DrawerTitle>
													<DrawerDescription>
														{t("manage-reviewers-and-their-assignments")}
													</DrawerDescription>
												</DrawerHeader>
												<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-4">
													<div className="grid grid-cols-2 gap-2">
														<Button
															variant="outline"
															size="sm"
															className={cn(actionPillClass, "col-span-2")}
															onClick={handleResetCounts}
														>
															<RotateCw data-icon="inline-start" />
															{t("reset-counts")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className={actionPillClass}
															onClick={exportData}
														>
															<Save data-icon="inline-start" />
															{t("pr.exportData")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className={actionPillClass}
															onClick={() =>
																document.getElementById("import-file")?.click()
															}
														>
															<Download data-icon="inline-start" />
															{t("history.import")}
														</Button>
														{deleteReviewerButton}
														{reviewerColumnsButton}
													</div>
													<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 [scrollbar-gutter:stable]">
														<ReviewersTable
															teamSlug={teamSlug}
															showViewControls={false}
														/>
													</div>
												</div>
											</DrawerContent>
										</Drawer>
									) : (
										<Dialog
											open={reviewersDrawerOpen}
											onOpenChange={setReviewersDrawerOpen}
										>
											<DialogTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													className={actionPillClass}
												>
													<Menu data-icon="inline-start" />
													<span>{t("pr.manageReviewers")}</span>
												</Button>
											</DialogTrigger>
											<DialogContent className="max-h-[88dvh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-5xl">
												<div className="border-b border-border/60 bg-muted/20 px-6 py-5 pr-14">
													<DialogHeader>
														<DialogTitle className="text-lg font-semibold tracking-tight">
															{t("pr.reviewers")}
														</DialogTitle>
														<DialogDescription>
															{t("manage-reviewers-and-their-assignments")}
														</DialogDescription>
													</DialogHeader>
												</div>
												<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-4">
													<div className="flex flex-wrap items-center justify-end gap-2">
														<Button
															variant="outline"
															size="sm"
															className={actionPillClass}
															onClick={handleResetCounts}
														>
															<RotateCw data-icon="inline-start" />
															{t("reset-counts")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className={actionPillClass}
															onClick={exportData}
														>
															<Save data-icon="inline-start" />
															{t("pr.exportData")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className={actionPillClass}
															onClick={() =>
																document.getElementById("import-file")?.click()
															}
														>
															<Download data-icon="inline-start" />
															{t("history.import")}
														</Button>
														{deleteReviewerButton}
														{reviewerColumnsButton}
													</div>
													<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 [scrollbar-gutter:stable]">
														<ReviewersTable
															teamSlug={teamSlug}
															showViewControls={false}
														/>
													</div>
												</div>
											</DialogContent>
										</Dialog>
									)}
								</div>
							)}
						</div>
					</CollapsibleContent>
				</div>
			</Collapsible>
		</header>
	);
}
