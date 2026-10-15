"use client";

import { useMutation, useQuery } from "convex/react";
import {
	ChevronDown,
	FileText,
	History,
	Undo2,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/initials";
import type { GroupedAssignmentHistoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UndoConfirmContent } from "./assignment/UndoConfirmContent";
import { HistoryChatThreadLinks } from "./HistoryChatThreadLinks";
import { usePRReview } from "./PRReviewContext";
import { TagBadge } from "./TagBadge";

function getPRNumber(prUrl?: string) {
	return prUrl?.match(/(?:pull|pulls|merge_requests)\/(\d+)(?:[/?#]|$)/i)?.[1];
}

/** Entries shown before "show more": enough to prove the last assignments went out. */
const HISTORY_PREVIEW_COUNT = 5;

export function FeedHistory({ teamSlug }: { teamSlug?: string }) {
	const t = useTranslations();
	const locale = useLocale();
	const {
		userInfo,
		reviewers,
		myAssignmentsOnly,
		toggleMyAssignmentsOnly,
		canManageCurrentTeam,
	} = usePRReview();
	const [showAll, setShowAll] = useState(false);
	const [undoingId, setUndoingId] = useState<string | null>(null);
	const undoAssignment = useMutation(api.mutations.undoAssignmentFromHistory);

	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") || [];
	const assignmentHistory: GroupedAssignmentHistoryItem[] =
		useQuery(
			api.queries.getAssignmentHistory,
			teamSlug ? { teamSlug } : "skip",
		) || [];

	const filteredAssignmentHistory = useMemo(() => {
		if (!myAssignmentsOnly) return assignmentHistory;
		const userEmail = userInfo?.email?.toLowerCase().trim();
		if (!userEmail) return assignmentHistory;

		const myReviewerIds = new Set(
			reviewers
				.filter((reviewer) => reviewer.email.toLowerCase().trim() === userEmail)
				.map((reviewer) => String(reviewer._id)),
		);

		return assignmentHistory.filter((item) => {
			const assignedForMe = item.reviewers.some((reviewer) =>
				myReviewerIds.has(reviewer.reviewerId),
			);
			const assignedByMe =
				(item.actionByReviewerId
					? myReviewerIds.has(item.actionByReviewerId)
					: false) ||
				(item.actionByEmail
					? item.actionByEmail.toLowerCase().trim() === userEmail
					: false);

			return assignedForMe || assignedByMe;
		});
	}, [assignmentHistory, myAssignmentsOnly, reviewers, userInfo?.email]);

	const myEmail = userInfo?.email?.toLowerCase().trim();
	const previewHistory = filteredAssignmentHistory.slice(
		0,
		HISTORY_PREVIEW_COUNT,
	);
	const moreHistory = filteredAssignmentHistory.slice(HISTORY_PREVIEW_COUNT);
	const hasHiddenHistory = moreHistory.length > 0;

	const getTagBadge = (tagId: string) => {
		const tag = tags.find((item: Doc<"tags">) => item._id === tagId);
		if (!tag) return null;

		return <TagBadge name={tag.name} color={tag.color} className="text-xs" />;
	};

	const handleUndo = async (item: GroupedAssignmentHistoryItem) => {
		if (!teamSlug) return;
		setUndoingId(item.id);
		try {
			const result = await undoAssignment({
				teamSlug,
				historyId: item.historyId,
			});
			if (!result.success)
				throw new Error("Assignment history entry not found");
			toast({
				title: t("history.undoSuccessTitle"),
				description: getPRNumber(item.prUrl)
					? t("history.undoneEntryPr", {
							number: getPRNumber(item.prUrl) ?? "",
							name: item.reviewers
								.map((reviewer) => reviewer.reviewerName)
								.join(", "),
						})
					: t("history.undoneEntry", {
							name: item.reviewers
								.map((reviewer) => reviewer.reviewerName)
								.join(", "),
						}),
			});
		} catch {
			toast({
				title: t("history.undoErrorTitle"),
				description: t("history.undoErrorDescription"),
				variant: "destructive",
			});
		} finally {
			setUndoingId(null);
		}
	};

	// One history row; `isLast` drops the divider under the last row shown.
	const renderEntry = (item: GroupedAssignmentHistoryItem, isLast: boolean) => {
		const reviewerNames = item.reviewers
			.map((reviewer) => reviewer.reviewerName)
			.join(", ");
		const prNumber = getPRNumber(item.prUrl);
		const isRealAssignment = !item.skipped && !item.isAbsentSkip;

		return (
			<article
				key={item.id}
				data-history-entry
				className="group relative grid grid-cols-[3.5rem_minmax(0,1fr)] px-4 pt-4 lg:px-5"
			>
				<div className="relative z-10 flex justify-center pt-0.5">
					<Avatar size="lg">
						<AvatarFallback className="bg-muted font-semibold text-foreground">
							{item.reviewerCount > 1 ? (
								<UsersRound className="size-5" aria-hidden="true" />
							) : (
								getInitials(item.reviewers[0]?.reviewerName)
							)}
						</AvatarFallback>
					</Avatar>
				</div>

				<div
					className={cn("min-w-0 pb-4", !isLast && "border-b border-border/70")}
				>
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div className="min-w-0">
							<h3 className="truncate text-base font-medium text-foreground">
								{item.reviewerCount === 1
									? item.reviewers[0]?.reviewerName
									: t("history.assigneesCount", {
											count: item.reviewerCount,
										})}
							</h3>
							<div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
								{prNumber && item.prUrl ? (
									<a
										href={item.prUrl}
										target="_blank"
										rel="noreferrer noopener"
										className="font-mono text-foreground underline-offset-4 hover:underline"
									>
										{t("history.entryPrLabel", {
											number: prNumber,
										})}
									</a>
								) : (
									t("history.entryNoPr")
								)}
								{" · "}
								{new Intl.DateTimeFormat(locale, {
									day: "numeric",
									month: "short",
									hour: "2-digit",
									minute: "2-digit",
								}).format(item.timestamp)}
								{canManageCurrentTeam ? (
									<AlertDialog>
										<Tooltip>
											<TooltipTrigger asChild>
												<AlertDialogTrigger asChild>
													<Button
														variant="ghost"
														size="icon-xs"
														className="text-muted-foreground hover:text-destructive [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:data-[state=open]:opacity-100"
														aria-label={
															prNumber
																? t("history.undoEntryPr", {
																		number: prNumber,
																		name: reviewerNames,
																	})
																: t("history.undoEntry", {
																		name: reviewerNames,
																	})
														}
													>
														<Undo2 aria-hidden="true" />
													</Button>
												</AlertDialogTrigger>
											</TooltipTrigger>
											<TooltipContent>{t("history.undoAction")}</TooltipContent>
										</Tooltip>
										<UndoConfirmContent
											title={
												prNumber
													? t("history.undoLastTitlePr", {
															number: prNumber,
															name: reviewerNames,
														})
													: t("history.undoLastTitle", {
															name: reviewerNames,
														})
											}
											description={
												<>
													{t("history.undoConfirmDescription", {
														count: item.reviewerCount,
														names: reviewerNames,
													})}
													{item.batchId ? (
														<span className="mt-2 block">
															{t("history.undoBatchDescription")}
														</span>
													) : null}
													{isRealAssignment ? (
														<span className="mt-2 block">
															{t("history.undoMetricDescription")}
														</span>
													) : null}
												</>
											}
											pending={undoingId === item.id}
											onConfirm={() => void handleUndo(item)}
										/>
									</AlertDialog>
								) : null}
							</div>
							{(item.actionByName || item.actionByEmail) &&
							item.actionByEmail?.toLowerCase().trim() !== myEmail ? (
								<p className="mt-0.5 text-xs text-muted-foreground">
									{t("history.assignedBy")}{" "}
									{item.actionByName || item.actionByEmail}
								</p>
							) : null}
						</div>
						<div className="flex flex-wrap justify-end gap-1">
							{item.urgent ? (
								<Badge
									variant="destructive"
									className="text-red-700 dark:text-red-300"
								>
									{t("pr.urgent")}
								</Badge>
							) : null}
							{item.crossTeamReview ? (
								<Badge variant="outline">{t("pr.crossTeamReview")}</Badge>
							) : null}
							{item.forced ? (
								<Badge variant="secondary">
									{t("history.handPickedBadge")}
								</Badge>
							) : null}
							{item.skipped || item.isAbsentSkip ? (
								<Badge variant="outline">{t("history.skippedBadge")}</Badge>
							) : null}
						</div>
					</div>

					{item.reviewerCount > 1 ? (
						<div className="mt-3 space-y-2">
							{item.reviewers.map((reviewer) => (
								<div
									key={`${reviewer.reviewerId}-${reviewer.timestamp}`}
									className="flex items-center gap-2 text-sm"
								>
									<Avatar size="sm">
										<AvatarFallback>
											{getInitials(reviewer.reviewerName)}
										</AvatarFallback>
									</Avatar>
									<span className="font-medium">{reviewer.reviewerName}</span>
									{reviewer.tagId ? getTagBadge(reviewer.tagId) : null}
								</div>
							))}
						</div>
					) : item.reviewers[0]?.tagId ? (
						<div className="mt-2">{getTagBadge(item.reviewers[0].tagId)}</div>
					) : null}

					<div className="mt-3 flex flex-wrap items-center gap-1 empty:hidden">
						{item.contextUrl ? (
							<Button variant="ghost" size="xs" asChild>
								<Link
									href={item.contextUrl}
									target="_blank"
									rel="noreferrer noopener"
								>
									<FileText aria-hidden="true" />
									{t("common.viewContext")}
								</Link>
							</Button>
						) : null}
						<HistoryChatThreadLinks item={item} />
					</div>
				</div>
			</article>
		);
	};

	return (
		<section className="calm-section page-enter w-full">
			<div className="calm-section-header">
				<div className="flex min-w-0 items-center gap-2">
					<History className="text-muted-foreground" aria-hidden="true" />
					<h2 className="text-lg font-semibold lg:text-xl">
						{t("pr.history")}
					</h2>
				</div>
				<div className="flex items-center gap-2">
					<label
						htmlFor="history-my-assignments-toggle"
						className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground lg:text-sm"
					>
						{t("history.myAssignmentsOnlyLabel")}
					</label>
					<Switch
						id="history-my-assignments-toggle"
						checked={myAssignmentsOnly}
						onCheckedChange={(checked) => {
							if (checked !== myAssignmentsOnly) toggleMyAssignmentsOnly();
						}}
					/>
				</div>
			</div>

			<div role="region" aria-label={t("pr.history")}>
				{filteredAssignmentHistory.length === 0 ? (
					<Empty className="m-4 border border-border/70 bg-muted/20 p-6 lg:p-8">
						<EmptyHeader>
							<EmptyDescription>{t("pr.noAssignments")}</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<Collapsible open={showAll} onOpenChange={setShowAll}>
						<div className="relative">
							<div
								aria-hidden="true"
								className="absolute top-9 bottom-9 left-11 w-px bg-border/80 lg:left-12"
							/>
							{previewHistory.map((item, index) =>
								renderEntry(
									item,
									index === previewHistory.length - 1 && !showAll,
								),
							)}
							{/* The rest unfolds below the first rows, animating its height; closed, it
							    is unmounted, so its links are out of the tab order. */}
							<CollapsibleContent>
								{moreHistory.map((item, index) =>
									renderEntry(item, index === moreHistory.length - 1),
								)}
							</CollapsibleContent>
						</div>
						{hasHiddenHistory ? (
							<div className="border-t border-border/70 p-2 text-center">
								<CollapsibleTrigger asChild>
									<Button variant="ghost" size="sm">
										{t(showAll ? "history.showLess" : "history.showMore")}
										<ChevronDown
											className={cn(
												"transition-transform",
												showAll && "rotate-180",
											)}
											aria-hidden="true"
										/>
									</Button>
								</CollapsibleTrigger>
							</div>
						) : null}
					</Collapsible>
				)}
			</div>
		</section>
	);
}
