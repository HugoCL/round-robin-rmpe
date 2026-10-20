"use client";

import {
	CalendarDays,
	Ellipsis,
	RotateCw,
	Tag,
	UserMinus,
	UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type RefObject, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { focusDialogItself } from "@/components/ui/dialog";
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
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Id } from "@/convex/_generated/dataModel";
import { useConvexTags } from "@/hooks/useConvexTags";
import { AddReviewerDialog } from "./dialogs/AddReviewerDialog";
import { DeleteReviewerDialog } from "./dialogs/DeleteReviewerDialog";
import { TeamAbsencesDialog } from "./dialogs/TeamAbsencesDialog";
import { usePRReview } from "./PRReviewContext";
import { ReviewersTable } from "./ReviewersTable";
import { TagManager } from "./TagManager";

function readCardRotationTag(teamSlug?: string): Id<"tags"> | undefined {
	try {
		const stored = window.localStorage.getItem(
			`la-lista-assignment-tag:${teamSlug ?? ""}`,
		);
		return stored ? (JSON.parse(stored) ?? undefined) : undefined;
	} catch {
		return undefined;
	}
}

export function ReviewersPanel({
	teamSlug,
	open,
	onOpenChange,
	returnFocusTo,
}: {
	teamSlug?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The sheet has no trigger, so on close focus goes back here. */
	returnFocusTo: RefObject<HTMLElement | null>;
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
	const [resetOpen, setResetOpen] = useState(false);
	const readOnly = !canManageCurrentTeam;
	const { tags } = useConvexTags(teamSlug);
	// Each open starts on the rotation the card shows then (same stored key);
	// the toggle only changes this panel.
	const [rotationTagId, setRotationTagId] = useState<Id<"tags">>();
	const [wasOpen, setWasOpen] = useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) setRotationTagId(readCardRotationTag(teamSlug));
	}
	const activeRotationTagId = tags.some((tag) => tag._id === rotationTagId)
		? rotationTagId
		: undefined;

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent
					className="gap-0 rounded-none p-0 data-[side=right]:max-sm:w-full data-[side=right]:sm:max-w-xl"
					onOpenAutoFocus={focusDialogItself}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						returnFocusTo.current?.focus();
					}}
				>
					<SheetHeader className="flex-row flex-wrap items-center gap-x-3 gap-y-2 p-5 pr-14">
						<SheetTitle className="flex items-center gap-2">
							{t("pr.reviewers")}
							<Badge
								variant="secondary"
								aria-label={t("reviewersPanel.entriesCount", {
									count: reviewers.length,
								})}
							>
								{reviewers.length}
							</Badge>
						</SheetTitle>
						<SheetDescription className="sr-only">
							{t("reviewersPanel.description")}
						</SheetDescription>
						<div className="ml-auto flex shrink-0 items-center gap-1">
							{canManageCurrentTeam ? (
								<AddReviewerDialog
									onAddReviewer={addReviewer}
									trigger={
										<Button variant="outline" size="sm" className="mr-1">
											<UserPlus data-icon="inline-start" />
											{t("pr.addReviewer")}
										</Button>
									}
								/>
							) : null}
							<TeamAbsencesDialog
								trigger={
									<IconActionButton label={t("absenceTimeline.open")}>
										<CalendarDays />
									</IconActionButton>
								}
							/>
							{canManageCurrentTeam ? (
								<>
									<TagManager
										trigger={
											<IconActionButton label={t("reviewersPanel.manageTags")}>
												<Tag />
											</IconActionButton>
										}
									/>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<IconActionButton label={t("reviewersPanel.moreActions")}>
												<Ellipsis />
											</IconActionButton>
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
											<DropdownMenuItem onSelect={() => setResetOpen(true)}>
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
						</div>
					</SheetHeader>
					{tags.length > 0 ? (
						<div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
							<span className="text-sm text-muted-foreground">
								{t("pr.assignmentModeLabel")}
							</span>
							<ToggleGroup
								type="single"
								variant="outline"
								size="sm"
								value={activeRotationTagId ?? "regular"}
								onValueChange={(value) => {
									if (!value) return;
									setRotationTagId(
										value === "regular" ? undefined : (value as Id<"tags">),
									);
								}}
								aria-label={t("pr.assignmentModeLabel")}
								className="flex-wrap"
							>
								<ToggleGroupItem
									value="regular"
									className="px-3 text-sm data-[state=on]:bg-primary/12 data-[state=on]:font-medium data-[state=on]:text-primary"
								>
									{t("pr.assignmentModeRegularShort")}
								</ToggleGroupItem>
								{tags.map((tag) => (
									<ToggleGroupItem
										key={tag._id}
										value={tag._id}
										className="gap-1.5 px-3 text-sm data-[state=on]:bg-primary/12 data-[state=on]:font-medium data-[state=on]:text-primary"
									>
										<span
											className="size-2 rounded-full"
											style={{ backgroundColor: tag.color }}
											aria-hidden="true"
										/>
										{tag.name}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</div>
					) : null}
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
						{reviewers.length === 0 ? (
							<Empty className="py-6">
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
							<ReviewersTable
								teamSlug={teamSlug}
								readOnly={readOnly}
								rotationTagId={activeRotationTagId}
							/>
						)}
					</div>
				</SheetContent>
			</Sheet>
			<DeleteReviewerDialog
				reviewers={reviewers}
				onDeleteReviewer={removeReviewer}
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
			/>
			<AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("reset-counts")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("messages.resetCountsConfirmation")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => void handleResetCounts()}
						>
							{t("reset-counts")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
