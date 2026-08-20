import {
	Bot,
	Calendar,
	ChevronDown,
	ClipboardList,
	Download,
	Flag,
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
		<div className="flex flex-wrap justify-start gap-2">
			<TagManager />
			<AddReviewerDialog
				onAddReviewer={addReviewer}
				trigger={
					<Button variant="outline" size="sm" className="min-h-11 sm:min-h-8">
						<UserPlus data-icon="inline-start" />
						{t("pr.addReviewer")}
					</Button>
				}
			/>
			<CreateEventDialog
				trigger={
					<Button variant="outline" size="sm" className="min-h-11 sm:min-h-8">
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
				<Button
					variant="outline"
					size="sm"
					className="min-h-11 rounded-full border-border/70 bg-background/70 sm:min-h-8"
				>
					<UserMinus data-icon="inline-start" />
					<span>{t("pr.deleteReviewer")}</span>
				</Button>
			}
		/>
	) : null;

	const reviewerColumnsButton = (
		<div className="flex items-center gap-2">
			<span className="text-sm font-medium text-foreground/90">
				{visibleColumnsCount}/3
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="min-h-11 rounded-full border-border/70 bg-background/70 sm:min-h-8"
					>
						<SlidersHorizontal data-icon="inline-start" />
						{t("pr.viewColumns")}
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
		</div>
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
						<div className="flex items-center gap-1">
							<nav
								className="flex items-center gap-0.5"
								aria-label={t("common.options")}
							>
								{userInfo?.email && (
									<PushNotificationManager
										userEmail={userInfo.email}
										iconOnly
									/>
								)}
								<ThemeToggle />
								<ChangelogDialog iconOnly />
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="outline"
												size="sm"
												className="h-9 gap-1.5 border-primary/20 bg-primary/10 px-2.5 text-primary hover:bg-primary/15 hover:text-primary sm:px-3"
												aria-label={t("agentSetup.navbarTooltip")}
												aria-expanded={agentSetupOpen}
												aria-haspopup="dialog"
												onClick={() => openAgentSetupDialog()}
											>
												<Bot />
												<span className="hidden sm:inline">
													{t("agentSetup.navbarLabel")}
												</span>
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>{t("agentSetup.navbarTooltip")}</p>
										</TooltipContent>
									</Tooltip>
									{teamSlug ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													asChild
													variant="ghost"
													size="icon"
													aria-label={t("featureFlags.shortcut")}
												>
													<Link href={`/${locale}/${teamSlug}/feature-flags`}>
														<Flag />
													</Link>
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>{t("featureFlags.shortcut")}</p>
											</TooltipContent>
										</Tooltip>
									) : null}
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												asChild
												variant="ghost"
												size="icon"
												aria-label={t("suggestions.shortcut")}
											>
												<Link href={`/${locale}/suggestions`}>
													<Lightbulb />
												</Link>
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>{t("suggestions.shortcut")}</p>
										</TooltipContent>
									</Tooltip>
									{isAdmin ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													asChild
													variant="ghost"
													size="icon"
													aria-label={t("survey.shortcut")}
												>
													<Link href={`/${locale}/surveys`}>
														<ClipboardList />
													</Link>
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>{t("survey.shortcut")}</p>
											</TooltipContent>
										</Tooltip>
									) : null}
								</TooltipProvider>
								<HeaderOptionsDrawer />
							</nav>
							<div className="ml-0.5 border-l border-border/70 pl-1.5">
								<CollapsibleTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="size-9 rounded-full p-0 xl:h-9 xl:w-auto xl:px-3"
										aria-label={
											actionsOpen
												? `${t("common.hide")} ${t("pr.actions")}`
												: `${t("common.show")} ${t("pr.actions")}`
										}
									>
										<span className="hidden xl:inline">{t("pr.actions")}</span>
										<ChevronDown
											className={cn(
												"h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none",
												actionsOpen && "rotate-180",
											)}
										/>
									</Button>
								</CollapsibleTrigger>
							</div>
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
													className="min-h-11 rounded-full border-border/70 bg-background/70 sm:min-h-8"
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
															className="col-span-2 min-h-11 rounded-full border-border/70 bg-background/70"
															onClick={handleResetCounts}
														>
															<RotateCw data-icon="inline-start" />
															{t("reset-counts")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className="min-h-11 rounded-full border-border/70 bg-background/70"
															onClick={exportData}
														>
															<Save data-icon="inline-start" />
															{t("pr.exportData")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className="min-h-11 rounded-full border-border/70 bg-background/70"
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
													className="rounded-full border-border/70 bg-background/70"
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
															className="rounded-full border-border/70 bg-background/70"
															onClick={handleResetCounts}
														>
															<RotateCw data-icon="inline-start" />
															{t("reset-counts")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className="rounded-full border-border/70 bg-background/70"
															onClick={exportData}
														>
															<Save data-icon="inline-start" />
															{t("pr.exportData")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className="rounded-full border-border/70 bg-background/70"
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
