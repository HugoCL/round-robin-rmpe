import {
	Calendar,
	ChevronDown,
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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
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
	const [actionsOpen, setActionsOpen] = useState(false);
	const visibleColumnsCount = [showAssignments, showTags, showEmails].filter(
		Boolean,
	).length;

	const reviewerActions = canManageCurrentTeam ? (
		<div className="flex flex-wrap gap-2 justify-center">
			<TagManager />
			<AddReviewerDialog
				onAddReviewer={addReviewer}
				trigger={
					<Button variant="outline" size="sm">
						<UserPlus className="h-4 w-4 mr-2" />
						{t("pr.addReviewer")}
					</Button>
				}
			/>
			<CreateEventDialog
				trigger={
					<Button variant="outline" size="sm">
						<Calendar className="h-4 w-4 mr-2" />
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
					className="rounded-full border-border/70 bg-background/70"
				>
					<UserMinus className="h-4 w-4" />
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
						className="rounded-full border-border/70 bg-background/70"
					>
						<SlidersHorizontal className="h-4 w-4 mr-2" />
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
						<div className="space-y-1">
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
						<div className="space-y-1">
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
						<div className="space-y-1">
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
		<section className="calm-shell px-4 py-3 md:px-6 md:py-4">
			<Collapsible open={actionsOpen} onOpenChange={setActionsOpen}>
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="min-w-0 space-y-2">
							<div className="flex flex-wrap items-end gap-x-4 gap-y-2">
								<div className="min-w-0">
									<h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
										{t("pr.title")}
									</h1>
									{isForeignTeamView && (
										<p className="mt-1 text-sm text-muted-foreground">
											{t("team.foreignTeamReadonlyBanner")}
										</p>
									)}
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<TeamSwitcher teamSlug={teamSlug} />
									<TeamWeeklyPRCounter teamSlug={teamSlug} />
								</div>
							</div>
						</div>
						<div className="flex items-center gap-2 self-start lg:self-auto">
							<div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/75 px-2 py-1">
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
												asChild
												variant="ghost"
												size="icon"
												aria-label={t("suggestions.shortcut")}
											>
												<Link href={`/${locale}/suggestions`}>
													<Lightbulb className="h-4 w-4" />
												</Link>
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>{t("suggestions.shortcut")}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<HeaderOptionsDrawer />
							</div>
							<div className="rounded-full border border-border/70 bg-background/75 p-1">
								<CollapsibleTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										aria-label={
											actionsOpen
												? `${t("common.hide")} ${t("pr.actions")}`
												: `${t("common.show")} ${t("pr.actions")}`
										}
									>
										<ChevronDown
											className={`h-4 w-4 transition-transform ${
												actionsOpen ? "rotate-180" : "rotate-0"
											}`}
										/>
									</Button>
								</CollapsibleTrigger>
							</div>
						</div>
					</div>
					<CollapsibleContent className="overflow-hidden border-t border-border/60 pt-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
						<div className="flex flex-wrap items-center justify-end gap-2">
							{!canManageCurrentTeam ? (
								<div className="rounded-full border border-border/70 bg-background/70 px-4 py-2 text-sm text-muted-foreground">
									{isAdmin
										? t("team.foreignTeamAdminBanner")
										: t("team.foreignTeamReadonlyBanner")}
								</div>
							) : (
								<div className="flex items-center gap-2">
									{reviewerActions}
									<div className="mx-1 h-6 w-px bg-border/70" />
									{isMobile ? (
										<Drawer
											open={reviewersDrawerOpen}
											onOpenChange={setReviewersDrawerOpen}
										>
											<DrawerTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													className="rounded-full border-border/70 bg-background/70"
												>
													<Menu className="h-4 w-4" />
													<span>{t("pr.manageReviewers")}</span>
												</Button>
											</DrawerTrigger>
											<DrawerContent>
												<DrawerHeader>
													<DrawerTitle>{t("pr.reviewers")}</DrawerTitle>
													<DrawerDescription>
														{t("manage-reviewers-and-their-assignments")}
													</DrawerDescription>
												</DrawerHeader>
												<div className="space-y-3 px-4 pb-4">
													<div className="flex flex-wrap items-center justify-end gap-2">
														<Button
															variant="outline"
															size="sm"
															className="rounded-full border-border/70 bg-background/70"
															onClick={handleResetCounts}
														>
															<RotateCw className="h-4 w-4 mr-2" />
															{t("reset-counts")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className="rounded-full border-border/70 bg-background/70"
															onClick={exportData}
														>
															<Save className="h-4 w-4 mr-2" />
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
															<Download className="h-4 w-4 mr-2" />
															{t("history.import")}
														</Button>
														{deleteReviewerButton}
														{reviewerColumnsButton}
													</div>
													<div className="max-h-[60vh] overflow-y-auto">
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
													<Menu className="h-4 w-4" />
													<span>{t("pr.manageReviewers")}</span>
												</Button>
											</DialogTrigger>
											<DialogContent className="max-h-[85vh] overflow-y-auto p-0 sm:max-w-4xl">
												<div className="px-6 pt-4">
													<DialogHeader>
														<DialogTitle>{t("pr.reviewers")}</DialogTitle>
														<DialogDescription>
															{t("manage-reviewers-and-their-assignments")}
														</DialogDescription>
													</DialogHeader>
												</div>
												<div className="space-y-3 px-6 pb-4">
													<div className="flex flex-wrap items-center justify-end gap-2">
														<Button
															variant="outline"
															size="sm"
															className="rounded-full border-border/70 bg-background/70"
															onClick={handleResetCounts}
														>
															<RotateCw className="h-4 w-4 mr-2" />
															{t("reset-counts")}
														</Button>
														<Button
															variant="outline"
															size="sm"
															className="rounded-full border-border/70 bg-background/70"
															onClick={exportData}
														>
															<Save className="h-4 w-4 mr-2" />
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
															<Download className="h-4 w-4 mr-2" />
															{t("history.import")}
														</Button>
														{deleteReviewerButton}
														{reviewerColumnsButton}
													</div>
													<div className="max-h-[60vh] overflow-y-auto">
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
		</section>
	);
}
