"use client";

import { useMutation, useQuery } from "convex/react";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	ExternalLink,
	FileText,
	History,
	MessageSquare,
	Undo2,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import type { GroupedAssignmentHistoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePRReview } from "./PRReviewContext";

const INITIAL_VISIBLE_ENTRIES = 4;

function getInitials(name?: string) {
	return (
		name
			?.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0])
			.join("")
			.toUpperCase() || "?"
	);
}

function getPRNumber(prUrl?: string) {
	return prUrl?.match(/(?:pull|pulls|merge_requests)\/(\d+)(?:[/?#]|$)/i)?.[1];
}

export function FeedHistory({
	teamSlug,
	open,
	onOpenChange,
}: {
	teamSlug?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
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

	const visibleHistory = showAll
		? filteredAssignmentHistory
		: filteredAssignmentHistory.slice(0, INITIAL_VISIBLE_ENTRIES);

	const getTagBadge = (tagId: string) => {
		const tag = tags.find((item: Doc<"tags">) => item._id === tagId);
		if (!tag) return null;

		return (
			<Badge
				variant="secondary"
				className="text-xs"
				style={{
					backgroundColor: `${tag.color}20`,
					color: tag.color,
					borderColor: tag.color,
				}}
			>
				{tag.name}
			</Badge>
		);
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
				description: t("history.undoSuccessDescription", {
					count: result.undoneCount,
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

	const historyToggle = (
		<Tooltip>
			<TooltipTrigger asChild>
				<CollapsibleTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label={t(open ? "history.hide" : "history.show")}
					>
						{open ? (
							<>
								<ChevronUp className="lg:hidden" />
								<ChevronRight className="hidden lg:block" />
							</>
						) : (
							<>
								<ChevronDown className="lg:hidden" />
								<ChevronLeft className="hidden lg:block" />
							</>
						)}
					</Button>
				</CollapsibleTrigger>
			</TooltipTrigger>
			<TooltipContent side="left">
				{t(open ? "history.hide" : "history.show")}
			</TooltipContent>
		</Tooltip>
	);

	return (
		<TooltipProvider>
			<Collapsible
				open={open}
				onOpenChange={onOpenChange}
				className="page-enter h-full min-w-0"
			>
				<section
					className={cn(
						"calm-section h-full lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:overscroll-contain",
						!open && "lg:items-center lg:overflow-hidden lg:p-2! 2xl:p-2!",
					)}
				>
					<div
						className={cn(
							"calm-section-header",
							!open &&
								"w-full items-center border-0 pb-0 lg:h-full lg:flex-col lg:flex-nowrap lg:justify-start",
						)}
					>
						<div
							className={cn(
								"flex min-w-0 items-center gap-2",
								!open && "lg:flex-col",
							)}
						>
							<History className="text-muted-foreground" aria-hidden="true" />
							<h4
								className={cn(
									"text-lg font-semibold lg:text-xl",
									!open && "lg:[writing-mode:vertical-rl] lg:text-sm",
								)}
							>
								{t("pr.history")}
							</h4>
							{!open ? (
								<Badge
									variant="secondary"
									aria-label={t("history.entriesCount", {
										count: filteredAssignmentHistory.length,
									})}
								>
									{filteredAssignmentHistory.length}
								</Badge>
							) : null}
						</div>
						{open ? (
							<div className="flex items-center gap-2">
								<label
									htmlFor="history-my-assignments-toggle"
									className="whitespace-nowrap text-xs text-muted-foreground lg:text-sm"
								>
									{t("history.myAssignmentsOnlyLabel")}
								</label>
								<Switch
									id="history-my-assignments-toggle"
									checked={myAssignmentsOnly}
									onCheckedChange={(checked) => {
										if (checked !== myAssignmentsOnly)
											toggleMyAssignmentsOnly();
									}}
								/>
								{historyToggle}
							</div>
						) : (
							<div className="ml-auto lg:order-first lg:ml-0">
								{historyToggle}
							</div>
						)}
					</div>

					<CollapsibleContent
						role="region"
						aria-label={t("pr.history")}
						tabIndex={0}
						className="animation-duration-300 ease-in-out lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:data-closed:animate-none! lg:data-open:animate-none!"
					>
						{filteredAssignmentHistory.length === 0 ? (
							<Empty className="m-4 border border-border/70 bg-muted/20 p-6 lg:p-8">
								<EmptyHeader>
									<EmptyDescription>{t("pr.noAssignments")}</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							<>
								<div className="relative">
									<div
										aria-hidden="true"
										className="absolute top-9 bottom-9 left-11 w-px bg-border/80 lg:left-12"
									/>
									{visibleHistory.map((item, index) => {
										const reviewerNames = item.reviewers
											.map((reviewer) => reviewer.reviewerName)
											.join(", ");
										const prNumber = getPRNumber(item.prUrl);
										const isRealAssignment =
											!item.skipped && !item.isAbsentSkip;

										return (
											<article
												key={item.id}
												className="group relative grid grid-cols-[3.5rem_minmax(0,1fr)] px-4 pt-4 lg:px-5"
											>
												<div className="relative z-10 flex justify-center pt-0.5">
													<Avatar size="lg">
														<AvatarFallback
															className={cn(
																"font-semibold",
																isRealAssignment &&
																	"bg-primary text-primary-foreground",
															)}
														>
															{item.reviewerCount > 1 ? (
																<UsersRound
																	className="size-5"
																	aria-hidden="true"
																/>
															) : (
																getInitials(item.reviewers[0]?.reviewerName)
															)}
														</AvatarFallback>
													</Avatar>
												</div>

												<div
													className={cn(
														"min-w-0 pb-4",
														index < visibleHistory.length - 1 &&
															"border-b border-border/70",
													)}
												>
													<div className="flex flex-wrap items-start justify-between gap-2">
														<div className="min-w-0">
															<h5 className="truncate text-base font-semibold text-primary">
																{item.reviewerCount === 1
																	? item.reviewers[0]?.reviewerName
																	: t("history.assigneesCount", {
																			count: item.reviewerCount,
																		})}
															</h5>
															<p className="mt-0.5 text-xs text-muted-foreground">
																{new Intl.DateTimeFormat(locale, {
																	day: "numeric",
																	month: "short",
																	hour: "2-digit",
																	minute: "2-digit",
																}).format(item.timestamp)}
																{item.actionByName || item.actionByEmail
																	? ` · ${t("history.assignedBy")} ${
																			item.actionByName || item.actionByEmail
																		}`
																	: ""}
															</p>
														</div>
														<div className="flex flex-wrap justify-end gap-1">
															{item.urgent ? (
																<Badge variant="destructive">
																	{t("pr.urgent")}
																</Badge>
															) : null}
															{item.crossTeamReview ? (
																<Badge variant="outline">
																	{t("pr.crossTeamReview")}
																</Badge>
															) : null}
															{item.forced ? (
																<Badge variant="secondary">
																	{t("pr.forceAssign")}
																</Badge>
															) : null}
															{item.skipped || item.isAbsentSkip ? (
																<Badge variant="outline">{t("pr.skip")}</Badge>
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
																	<span className="font-medium">
																		{reviewer.reviewerName}
																	</span>
																	{reviewer.tagId
																		? getTagBadge(reviewer.tagId)
																		: null}
																</div>
															))}
														</div>
													) : item.reviewers[0]?.tagId ? (
														<div className="mt-2">
															{getTagBadge(item.reviewers[0].tagId)}
														</div>
													) : null}

													<div className="mt-3 flex flex-wrap items-center gap-1">
														{item.prUrl ? (
															<Button variant="ghost" size="xs" asChild>
																<Link
																	href={item.prUrl}
																	target="_blank"
																	rel="noreferrer noopener"
																>
																	<ExternalLink aria-hidden="true" />
																	{prNumber
																		? `PR #${prNumber}`
																		: t("common.viewPR")}
																</Link>
															</Button>
														) : null}
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
														{item.googleChatThreadUrl ? (
															<Button variant="ghost" size="xs" asChild>
																<Link
																	href={item.googleChatThreadUrl}
																	target="_blank"
																	rel="noreferrer noopener"
																>
																	<MessageSquare aria-hidden="true" />
																	{t("common.viewChatThread")}
																</Link>
															</Button>
														) : null}
														{canManageCurrentTeam ? (
															<AlertDialog>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<AlertDialogTrigger asChild>
																			<Button
																				variant="ghost"
																				size="icon-xs"
																				className="ml-auto text-muted-foreground hover:text-destructive"
																				aria-label={t("history.undoAction")}
																			>
																				<Undo2 aria-hidden="true" />
																			</Button>
																		</AlertDialogTrigger>
																	</TooltipTrigger>
																	<TooltipContent>
																		{t("history.undoAction")}
																	</TooltipContent>
																</Tooltip>
																<AlertDialogContent>
																	<AlertDialogHeader>
																		<AlertDialogTitle>
																			{t("history.undoConfirmTitle")}
																		</AlertDialogTitle>
																		<AlertDialogDescription>
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
																		</AlertDialogDescription>
																	</AlertDialogHeader>
																	<AlertDialogFooter>
																		<AlertDialogCancel>
																			{t("common.cancel")}
																		</AlertDialogCancel>
																		<AlertDialogAction
																			variant="destructive"
																			disabled={undoingId === item.id}
																			onClick={() => void handleUndo(item)}
																		>
																			{undoingId === item.id
																				? t("history.undoing")
																				: t("history.undoConfirmAction")}
																		</AlertDialogAction>
																	</AlertDialogFooter>
																</AlertDialogContent>
															</AlertDialog>
														) : null}
													</div>
												</div>
											</article>
										);
									})}
								</div>
								{filteredAssignmentHistory.length > INITIAL_VISIBLE_ENTRIES ? (
									<div className="border-t border-border/70 p-2 text-center">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setShowAll((value) => !value)}
										>
											{t(showAll ? "history.showLess" : "history.showMore")}
											<ChevronDown
												className={cn(
													"transition-transform",
													showAll && "rotate-180",
												)}
												aria-hidden="true"
											/>
										</Button>
									</div>
								) : null}
							</>
						)}
					</CollapsibleContent>
				</section>
			</Collapsible>
		</TooltipProvider>
	);
}
