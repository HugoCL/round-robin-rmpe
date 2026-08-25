"use client";

import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Ellipsis,
	RotateCw,
	Tag,
	UserMinus,
	UserPlus,
	Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
} from "@/components/ui/empty";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { cn } from "@/lib/utils";
import { AddReviewerDialog } from "./dialogs/AddReviewerDialog";
import { DeleteReviewerDialog } from "./dialogs/DeleteReviewerDialog";
import { usePRReview } from "./PRReviewContext";
import { ReviewersTable } from "./ReviewersTable";
import { TagManager } from "./TagManager";

export function ReviewersPanel({
	teamSlug,
	open,
	onOpenChange,
	className,
}: {
	teamSlug?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	className?: string;
}) {
	const t = useTranslations();
	const {
		reviewers,
		canManageCurrentTeam,
		addReviewer,
		removeReviewer,
		handleResetCounts,
		showTags,
		toggleShowTags,
	} = usePRReview();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const readOnly = !canManageCurrentTeam;

	const reviewersToggle = (
		<CollapsibleTrigger asChild>
			<span className="inline-flex">
				<IconActionButton
					label={t(open ? "reviewersPanel.hide" : "reviewersPanel.show")}
				>
					{open ? (
						<>
							<ChevronUp className="lg:hidden" />
							<ChevronLeft className="hidden lg:block" />
						</>
					) : (
						<>
							<ChevronDown className="lg:hidden" />
							<ChevronRight className="hidden lg:block" />
						</>
					)}
				</IconActionButton>
			</span>
		</CollapsibleTrigger>
	);

	return (
		<>
			<Collapsible
				open={open}
				onOpenChange={onOpenChange}
				className={cn("page-enter min-h-0 min-w-0 w-full", className)}
			>
				<section
					className={cn(
						"calm-section flex h-full w-full flex-col lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-hidden",
						open && "gap-0 p-3 md:p-4 2xl:p-4",
						!open && "p-3 lg:items-center lg:overflow-hidden lg:p-2! 2xl:p-2!",
					)}
				>
					<div
						className={cn(
							"calm-section-header",
							open && "flex-nowrap items-center gap-2 pb-3",
							!open &&
								"min-h-10 w-full items-center border-0 pb-0 lg:h-full lg:flex-col lg:flex-nowrap lg:justify-start",
						)}
					>
						<div
							className={cn(
								"flex min-w-0 items-center gap-2",
								!open && "lg:flex-col",
							)}
						>
							<Users className="text-muted-foreground" aria-hidden="true" />
							<h4
								className={cn(
									"text-lg font-semibold lg:text-xl",
									!open && "lg:[writing-mode:vertical-rl] lg:text-sm",
								)}
							>
								{t("pr.reviewers")}
							</h4>
							{open ? null : (
								<Badge
									variant="secondary"
									aria-label={t("reviewersPanel.entriesCount", {
										count: reviewers.length,
									})}
								>
									{reviewers.length}
								</Badge>
							)}
						</div>
						{open ? (
							<div className="flex items-center gap-1">
								{canManageCurrentTeam ? (
									<>
										<AddReviewerDialog
											onAddReviewer={addReviewer}
											trigger={
												<IconActionButton label={t("pr.addReviewer")}>
													<UserPlus />
												</IconActionButton>
											}
										/>
										<TagManager
											trigger={
												<IconActionButton
													label={t("reviewersPanel.manageTags")}
												>
													<Tag />
												</IconActionButton>
											}
										/>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<span className="inline-flex">
													<IconActionButton
														label={t("reviewersPanel.moreActions")}
													>
														<Ellipsis />
													</IconActionButton>
												</span>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-56">
												<DropdownMenuCheckboxItem
													checked={showTags}
													onSelect={(event) => event.preventDefault()}
													onCheckedChange={(checked) => {
														if (checked !== showTags) toggleShowTags();
													}}
												>
													{t("pr.showTags")}
												</DropdownMenuCheckboxItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem onClick={handleResetCounts}>
													<RotateCw />
													{t("reset-counts")}
												</DropdownMenuItem>
												<DropdownMenuItem
													variant="destructive"
													onSelect={() => setDeleteOpen(true)}
												>
													<UserMinus />
													{t("pr.deleteReviewer")}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</>
								) : null}
								{reviewersToggle}
							</div>
						) : (
							<div className="ml-auto lg:order-first lg:ml-0">
								{reviewersToggle}
							</div>
						)}
					</div>

					<CollapsibleContent
						role="region"
						aria-label={t("pr.reviewers")}
						tabIndex={0}
						className="animation-duration-300 min-h-0 flex-1 overflow-y-auto overscroll-contain ease-in-out [scrollbar-gutter:stable] lg:overflow-x-hidden lg:data-closed:animate-none! lg:data-open:animate-none!"
					>
						{reviewers.length === 0 ? (
							<Empty className="px-1 py-6">
								<EmptyHeader>
									<EmptyDescription>
										{t("reviewersPanel.emptyDescription")}
									</EmptyDescription>
								</EmptyHeader>
								{canManageCurrentTeam ? (
									<EmptyContent>
										<AddReviewerDialog
											onAddReviewer={addReviewer}
											trigger={
												<Button variant="outline" size="sm">
													<UserPlus data-icon="inline-start" />
													{t("pr.addReviewer")}
												</Button>
											}
										/>
									</EmptyContent>
								) : null}
							</Empty>
						) : (
							<ReviewersTable teamSlug={teamSlug} readOnly={readOnly} />
						)}
					</CollapsibleContent>
				</section>
			</Collapsible>
			<DeleteReviewerDialog
				reviewers={reviewers}
				onDeleteReviewer={removeReviewer}
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
			/>
		</>
	);
}
