import {
	Download,
	Menu,
	MoreHorizontal,
	RotateCw,
	Save,
	UserMinus,
	UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { TeamSwitcher } from "@/components/TeamSwitcher";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChangelogDialog } from "../ChangelogDialog";
import { AddReviewerDialog } from "../dialogs/AddReviewerDialog";
import { DeleteReviewerDialog } from "../dialogs/DeleteReviewerDialog";
import { HeaderOptionsDrawer } from "../HeaderOptionsDrawer";
import { usePRReview } from "../PRReviewContext";
import { ReviewersTable } from "../ReviewersTable";
import { TagManager } from "../TagManager";

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
		compactLayout,
		addReviewer,
		removeReviewer,
		reviewers,
		handleResetCounts,
		exportData,
		userInfo,
	} = usePRReview();
	const isMobile = useIsMobile();

	const reviewerActions = (
		<div className="flex flex-wrap gap-2 justify-center">
			<TagManager />
			<AddReviewerDialog
				onAddReviewer={async (name, email, googleChatUserId) => {
					await addReviewer(name, email, googleChatUserId);
					return true;
				}}
				trigger={
					<Button variant="outline" size="sm">
						<UserPlus className="h-4 w-4 mr-2" />
						{t("pr.addReviewer")}
					</Button>
				}
			/>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm">
						<MoreHorizontal className="h-4 w-4 mr-2" />
						{t("pr.actions")}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel>{t("pr.manageData")}</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onSelect={(e) => {
							e.preventDefault();
						}}
					>
						<DeleteReviewerDialog
							reviewers={reviewers}
							onDeleteReviewer={removeReviewer}
							trigger={
								<div className="flex items-center w-full">
									<UserMinus className="h-4 w-4 mr-2" />
									{t("pr.deleteReviewer")}
								</div>
							}
						/>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={handleResetCounts}>
						<RotateCw className="h-4 w-4 mr-2" />
						{t("reset-counts")}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={exportData}>
						<Save className="h-4 w-4 mr-2" />
						{t("pr.exportData")}
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={(e) => {
							e.preventDefault();
							document.getElementById("import-file")?.click();
						}}
					>
						<Download className="h-4 w-4 mr-2" />
						{t("history.import")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);

	return (
		<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
			<div className="flex items-center gap-3 flex-wrap">
				<h1 className="text-3xl font-bold">{t("pr.title")}</h1>
				<TeamSwitcher teamSlug={teamSlug} />
			</div>
			<div className="flex items-center gap-1">
				{userInfo?.email && (
					<PushNotificationManager userEmail={userInfo.email} iconOnly />
				)}
				<ThemeToggle />
				<ChangelogDialog iconOnly />
				<HeaderOptionsDrawer />

				{compactLayout && (
					<>
						<div className="h-6 w-px bg-border mx-1" />
						{isMobile ? (
							<Drawer
								open={reviewersDrawerOpen}
								onOpenChange={setReviewersDrawerOpen}
							>
								<DrawerTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="flex items-center gap-1"
									>
										<Menu className="h-4 w-4" />
										<span className="hidden sm:inline">
											{t("pr.manageReviewers")}
										</span>
									</Button>
								</DrawerTrigger>
								<DrawerContent>
									<DrawerHeader>
										<DrawerTitle>{t("pr.reviewers")}</DrawerTitle>
										<DrawerDescription>
											{t("manage-reviewers-and-their-assignments")}
										</DrawerDescription>
									</DrawerHeader>
									<div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
										<ReviewersTable teamSlug={teamSlug} />
									</div>
									<DrawerFooter className="flex flex-col gap-4">
										{reviewerActions}
										<DrawerClose asChild>
											<Button variant="outline">{t("common.close")}</Button>
										</DrawerClose>
									</DrawerFooter>
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
										className="flex items-center gap-1"
									>
										<Menu className="h-4 w-4" />
										<span className="hidden sm:inline">
											{t("pr.manageReviewers")}
										</span>
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
									<div className="px-6 pb-4 max-h-[60vh] overflow-y-auto">
										<ReviewersTable teamSlug={teamSlug} />
									</div>
									<DialogFooter className="px-6 pb-6 flex flex-col gap-4">
										{reviewerActions}
										<DialogClose asChild>
											<Button variant="outline">{t("common.close")}</Button>
										</DialogClose>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						)}
					</>
				)}
			</div>
		</div>
	);
}
