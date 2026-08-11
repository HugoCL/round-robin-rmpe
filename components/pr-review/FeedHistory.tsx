"use client";

import { useQuery } from "convex/react";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	ExternalLink,
	History,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
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
import type { GroupedAssignmentHistoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePRReview } from "./PRReviewContext";

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
	const { userInfo, reviewers, myAssignmentsOnly, toggleMyAssignmentsOnly } =
		usePRReview();

	// Use Convex for real-time tags and assignment history
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

	const getTagBadge = (tagId: string) => {
		const tag = tags.find((t: Doc<"tags">) => t._id === tagId);
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
								<ChevronUp data-icon="inline-start" className="lg:hidden" />
								<ChevronRight
									data-icon="inline-start"
									className="hidden lg:block"
								/>
							</>
						) : (
							<>
								<ChevronDown data-icon="inline-start" className="lg:hidden" />
								<ChevronLeft
									data-icon="inline-start"
									className="hidden lg:block"
								/>
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
						"calm-section h-full",
						!open && "lg:items-center lg:p-2! 2xl:p-2!",
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
									!open &&
										"lg:[writing-mode:vertical-rl] lg:rotate-180 lg:text-sm",
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
										if (checked !== myAssignmentsOnly) {
											toggleMyAssignmentsOnly();
										}
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
					<CollapsibleContent className="animation-duration-300 ease-in-out lg:data-closed:animate-none! lg:data-open:animate-none!">
						<div>
							{filteredAssignmentHistory.length === 0 ? (
								<Empty className="border border-border/70 bg-muted/20 p-6 lg:p-8">
									<EmptyHeader>
										<EmptyDescription>{t("pr.noAssignments")}</EmptyDescription>
									</EmptyHeader>
								</Empty>
							) : (
								<div className="calm-list">
									{filteredAssignmentHistory.slice(0, 6).map((item) => (
										<div
											key={item.id}
											className={cn(
												"flex flex-col items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/30 first:rounded-t-2xl last:rounded-b-2xl sm:flex-row sm:justify-between sm:gap-4 md:px-5 lg:px-6 lg:py-5",
												item.urgent && "urgent-card",
											)}
										>
											<div className="min-w-0 flex-1">
												<p className="break-words text-lg font-semibold lg:text-xl">
													{item.reviewerCount === 1
														? item.reviewers[0]?.reviewerName
														: t("history.assigneesCount", {
																count: item.reviewerCount,
															})}
												</p>
												{item.reviewerCount > 1 && (
													<div className="mt-2 flex flex-wrap gap-2">
														{item.reviewers.map((reviewer) => (
															<div
																key={`${reviewer.reviewerId}-${reviewer.timestamp}`}
																className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1 text-xs"
															>
																<span className="font-medium">
																	{reviewer.reviewerName}
																</span>
																{reviewer.tagId && getTagBadge(reviewer.tagId)}
															</div>
														))}
													</div>
												)}
												<div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
													<p className="text-xs text-muted-foreground lg:text-sm">
														{new Date(item.timestamp).toLocaleString()}
													</p>
													{(item.actionByName || item.actionByEmail) && (
														<>
															<span className="text-xs text-muted-foreground/50 lg:text-sm">
																·
															</span>
															<p className="text-xs text-muted-foreground lg:text-sm">
																{t("history.assignedBy")}{" "}
																{item.actionByName || item.actionByEmail}
															</p>
														</>
													)}
												</div>
												{item.prUrl && (
													<p className="mt-1 flex flex-wrap gap-2 text-xs lg:text-sm">
														<Link
															href={item.prUrl}
															target="_blank"
															rel="noreferrer noopener"
															aria-label={t("common.viewPR")}
															className="inline-flex items-center gap-1"
														>
															<Badge
																variant="outline"
																className="cursor-pointer hover:bg-primary/10 transition-colors"
															>
																{t("common.viewPR")}
																<ExternalLink
																	data-icon="inline-end"
																	className="ml-1"
																/>
															</Badge>
														</Link>
														{item.contextUrl && (
															<Link
																href={item.contextUrl}
																target="_blank"
																rel="noreferrer noopener"
																aria-label={t("common.viewContext")}
																className="inline-flex items-center gap-1"
															>
																<Badge
																	variant="outline"
																	className="cursor-pointer hover:bg-primary/10 transition-colors"
																>
																	{t("common.viewContext")}
																	<ExternalLink
																		data-icon="inline-end"
																		className="ml-1"
																	/>
																</Badge>
															</Link>
														)}
														{item.googleChatThreadUrl && (
															<Link
																href={item.googleChatThreadUrl}
																target="_blank"
																rel="noreferrer noopener"
																aria-label={t("common.viewChatThread")}
																className="inline-flex items-center gap-1"
															>
																<Badge
																	variant="outline"
																	className="cursor-pointer hover:bg-primary/10 transition-colors"
																>
																	{t("common.viewChatThread")}
																	<ExternalLink
																		data-icon="inline-end"
																		className="ml-1"
																	/>
																</Badge>
															</Link>
														)}
													</p>
												)}
												{item.reviewerCount === 1 &&
												item.reviewers[0]?.tagId ? (
													<div className="mt-1">
														{getTagBadge(item.reviewers[0].tagId)}
													</div>
												) : null}
											</div>
											<div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-col sm:items-end">
												{item.urgent && (
													<Badge className="bg-red-50 text-red-700 border-red-200 hover:border-transparent hover:bg-red-100 transition-colors dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60">
														{t("pr.urgent")}
													</Badge>
												)}
												{item.crossTeamReview && (
													<Badge className="border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:border-transparent hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
														{t("pr.crossTeamReview")}
													</Badge>
												)}
												{item.forced && (
													<Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:border-transparent hover:bg-amber-100 transition-colors">
														{t("pr.forceAssign")}
													</Badge>
												)}
												{(item.skipped || item.isAbsentSkip) && (
													<Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:border-transparent hover:bg-blue-100 transition-colors">
														{t("pr.skip")}
													</Badge>
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</CollapsibleContent>
				</section>
			</Collapsible>
		</TooltipProvider>
	);
}
