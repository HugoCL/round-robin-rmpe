"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
	AlertCircle,
	Info,
	MessageSquare,
	Sparkles,
	Undo2,
	Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import {
	type ReviewerSlotConfig,
	type ReviewerSlotPreview,
	type ReviewerSlotStrategy,
	ReviewerSlotsConfigurator,
} from "./assignment/ReviewerSlotsConfigurator";
import { ChatMessageCustomizer } from "./ChatMessageCustomizer";
import { usePRReview } from "./PRReviewContext";

type AssignmentMode = "regular" | "tag";

type ResolvedSlot = {
	slotIndex: number;
	reviewer: Doc<"reviewers">;
	tagId?: Id<"tags">;
};

type ResolvedPreview = {
	slots: ReviewerSlotPreview[];
	resolved: ResolvedSlot[];
	payloadSlots: Array<{
		strategy: ReviewerSlotStrategy;
		reviewerId?: Id<"reviewers">;
		tagId?: Id<"tags">;
	}>;
};

const createSlotId = () =>
	`slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultSlotForMode = (mode: AssignmentMode): ReviewerSlotConfig => ({
	id: createSlotId(),
	strategy: mode === "regular" ? "random" : "tag_random_selected",
});

function normalizeSlotForMode(
	slot: ReviewerSlotConfig,
	mode: AssignmentMode,
): ReviewerSlotConfig {
	const next = { ...slot };
	if (mode === "regular") {
		if (next.strategy !== "random" && next.strategy !== "specific") {
			next.strategy = "random";
		}
	} else if (
		next.strategy !== "tag_random_selected" &&
		next.strategy !== "tag_random_other" &&
		next.strategy !== "specific"
	) {
		next.strategy = "tag_random_selected";
	}

	if (next.strategy !== "specific") {
		next.reviewerId = undefined;
	}
	if (next.strategy !== "tag_random_other") {
		next.tagId = undefined;
	}
	return next;
}

function findUpcomingAfterCurrent(
	candidates: Doc<"reviewers">[],
	currentReviewerId: Id<"reviewers">,
): Doc<"reviewers"> | null {
	if (candidates.length <= 1) return null;

	const minCount = Math.min(
		...candidates.map((reviewer) => reviewer.assignmentCount),
	);
	const candidatesWithSameCount = candidates
		.filter(
			(reviewer) =>
				reviewer.assignmentCount === minCount &&
				reviewer._id !== currentReviewerId,
		)
		.sort((a, b) => a.createdAt - b.createdAt);

	if (candidatesWithSameCount.length > 0) {
		return candidatesWithSameCount[0];
	}

	const higherCountCandidates = candidates.filter(
		(reviewer) =>
			reviewer.assignmentCount > minCount && reviewer._id !== currentReviewerId,
	);

	if (higherCountCandidates.length === 0) return null;

	const nextMinCount = Math.min(
		...higherCountCandidates.map((reviewer) => reviewer.assignmentCount),
	);

	return (
		higherCountCandidates
			.filter((reviewer) => reviewer.assignmentCount === nextMinCount)
			.sort((a, b) => a.createdAt - b.createdAt)[0] || null
	);
}

export function AssignmentCard() {
	const t = useTranslations();
	const {
		teamSlug,
		nextReviewer,
		reviewers,
		assignmentFeed,
		undoAssignment: onUndoAssignment,
		userInfo: user,
	} = usePRReview();

	const [isAssigning, setIsAssigning] = useState(false);
	const [isMultiAssignmentEnabled, setIsMultiAssignmentEnabled] =
		useState(false);
	const [sendMessage, setSendMessage] = useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [customMessage, setCustomMessage] = useState("");
	const [enableCustomMessage, setEnableCustomMessage] = useState(false);
	const [mode, setMode] = useState<AssignmentMode>("regular");
	const [selectedTagId, setSelectedTagId] = useState<Id<"tags"> | undefined>(
		undefined,
	);
	const [reviewerCount, setReviewerCount] = useState(1);
	const [slotConfigs, setSlotConfigs] = useState<ReviewerSlotConfig[]>([
		defaultSlotForMode("regular"),
	]);
	const [liveSummary, setLiveSummary] = useState("");

	const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
	const [duplicateAssignment, setDuplicateAssignment] = useState<{
		reviewerName: string;
		timestamp: number;
	} | null>(null);

	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") || [];
	const nextReviewerByTag = useQuery(
		api.queries.getNextReviewerByTag,
		mode === "tag" && selectedTagId && teamSlug
			? { teamSlug, tagId: selectedTagId }
			: "skip",
	);

	const sendGoogleChatAction = useAction(api.actions.sendGoogleChatMessage);
	const sendGoogleChatGroupAction = useAction(
		api.actions.sendGoogleChatGroupMessage,
	);
	const checkPRAlreadyAssignedAction = useAction(
		api.actions.checkPRAlreadyAssigned,
	);
	const assignPRBatchMutation = useMutation(api.mutations.assignPRBatch);

	useEffect(() => {
		setSlotConfigs((prev) => {
			const normalized = prev.map((slot) => normalizeSlotForMode(slot, mode));
			if (normalized.length === reviewerCount) return normalized;
			if (normalized.length > reviewerCount)
				return normalized.slice(0, reviewerCount);
			const missing = reviewerCount - normalized.length;
			return [
				...normalized,
				...Array.from({ length: missing }).map(() => defaultSlotForMode(mode)),
			];
		});
	}, [reviewerCount, mode]);

	const effectiveReviewerCount = isMultiAssignmentEnabled ? reviewerCount : 1;
	const effectiveSlotConfigs = useMemo(() => {
		const normalized = slotConfigs.map((slot) =>
			normalizeSlotForMode(slot, mode),
		);
		if (isMultiAssignmentEnabled) {
			return normalized.slice(0, reviewerCount);
		}
		return [normalized[0] ?? defaultSlotForMode(mode)];
	}, [isMultiAssignmentEnabled, mode, reviewerCount, slotConfigs]);

	const configurationHash = useMemo(
		() =>
			JSON.stringify({
				mode,
				isMultiAssignmentEnabled,
				reviewerCount: effectiveReviewerCount,
				selectedTagId: selectedTagId ? String(selectedTagId) : null,
				slots: effectiveSlotConfigs.map((slot) => ({
					id: slot.id,
					strategy: slot.strategy,
					reviewerId: slot.reviewerId ? String(slot.reviewerId) : null,
					tagId: slot.tagId ? String(slot.tagId) : null,
				})),
				sendMessage,
			}),
		[
			effectiveReviewerCount,
			effectiveSlotConfigs,
			isMultiAssignmentEnabled,
			mode,
			selectedTagId,
			sendMessage,
		],
	);

	useEffect(() => {
		// Clear last assignment summary when the user changes current configuration.
		void configurationHash;
		setLiveSummary("");
	}, [configurationHash]);

	const selectedTag = useMemo(
		() => tags.find((tag: Doc<"tags">) => tag._id === selectedTagId),
		[selectedTagId, tags],
	);

	const currentUserReviewerId = useMemo(() => {
		if (!user?.email) return undefined;
		return reviewers.find(
			(reviewer) => reviewer.email.toLowerCase() === user.email.toLowerCase(),
		)?._id as Id<"reviewers"> | undefined;
	}, [reviewers, user?.email]);

	const activeNextReviewer =
		mode === "tag" ? nextReviewerByTag || null : nextReviewer;
	const isLoadingTagReviewer =
		mode === "tag" &&
		!!selectedTagId &&
		typeof nextReviewerByTag === "undefined";
	const availableReviewersForMode = useMemo(() => {
		const available = reviewers.filter((reviewer) => !reviewer.isAbsent);
		if (mode !== "tag") return available;
		if (!selectedTagId) return [];
		return available.filter((reviewer) =>
			reviewer.tags.includes(selectedTagId),
		);
	}, [mode, reviewers, selectedTagId]);
	const upcomingReviewer = useMemo(() => {
		if (!activeNextReviewer) return null;
		return findUpcomingAfterCurrent(
			availableReviewersForMode,
			activeNextReviewer._id as Id<"reviewers">,
		);
	}, [activeNextReviewer, availableReviewersForMode]);

	const resolvePreview = useMemo<ResolvedPreview>(() => {
		const previews: ReviewerSlotPreview[] = [];
		const resolved: ResolvedSlot[] = [];
		const payloadSlots: Array<{
			strategy: ReviewerSlotStrategy;
			reviewerId?: Id<"reviewers">;
			tagId?: Id<"tags">;
		}> = [];
		const selectedReviewerIds = new Set<string>();
		const virtualCounts = new Map<string, number>(
			reviewers.map((reviewer) => [
				String(reviewer._id),
				reviewer.assignmentCount,
			]),
		);
		const tagNameMap = new Map(tags.map((tag) => [String(tag._id), tag.name]));

		for (const [slotIndex, rawSlot] of effectiveSlotConfigs.entries()) {
			const slot = normalizeSlotForMode(rawSlot, mode);
			payloadSlots.push({
				strategy: slot.strategy,
				reviewerId: slot.reviewerId,
				tagId: slot.tagId,
			});

			const unresolved = (reason: string) => {
				previews.push({
					slotIndex,
					status: "unresolved",
					reason,
				});
			};

			if (slot.strategy === "specific") {
				if (!slot.reviewerId) {
					unresolved(t("pr.slotReasonMissingReviewer"));
					continue;
				}
				const target = reviewers.find(
					(reviewer) => reviewer._id === slot.reviewerId,
				);
				if (!target) {
					unresolved(t("pr.slotReasonReviewerNotFound"));
					continue;
				}
				if (target.isAbsent) {
					unresolved(t("pr.slotReasonReviewerAbsent"));
					continue;
				}
				if (selectedReviewerIds.has(String(target._id))) {
					unresolved(t("pr.slotReasonDuplicateReviewer"));
					continue;
				}
				selectedReviewerIds.add(String(target._id));
				virtualCounts.set(String(target._id), target.assignmentCount + 1);
				resolved.push({
					slotIndex,
					reviewer: target,
					tagId: slot.tagId,
				});
				previews.push({
					slotIndex,
					status: "resolved",
					reviewerName: target.name,
					tagName: slot.tagId ? tagNameMap.get(String(slot.tagId)) : undefined,
				});
				continue;
			}

			let requiredTagId: Id<"tags"> | undefined;
			if (mode === "regular") {
				if (slot.strategy !== "random") {
					unresolved(t("pr.slotReasonInvalidStrategy"));
					continue;
				}
			} else {
				if (slot.strategy === "tag_random_selected") {
					requiredTagId = selectedTagId;
				} else if (slot.strategy === "tag_random_other") {
					requiredTagId = slot.tagId;
				} else {
					unresolved(t("pr.slotReasonInvalidStrategy"));
					continue;
				}
				if (!requiredTagId) {
					unresolved(
						slot.strategy === "tag_random_selected"
							? t("pr.slotReasonMissingSelectedTag")
							: t("pr.slotReasonMissingTag"),
					);
					continue;
				}
			}

			const candidates = reviewers.filter((reviewer) => {
				if (reviewer.isAbsent) return false;
				if (currentUserReviewerId && reviewer._id === currentUserReviewerId) {
					return false;
				}
				if (selectedReviewerIds.has(String(reviewer._id))) return false;
				if (requiredTagId && !reviewer.tags.includes(requiredTagId))
					return false;
				return true;
			});

			const selected = [...candidates].sort((a, b) => {
				const aCount = virtualCounts.get(String(a._id)) ?? a.assignmentCount;
				const bCount = virtualCounts.get(String(b._id)) ?? b.assignmentCount;
				if (aCount !== bCount) return aCount - bCount;
				return a.createdAt - b.createdAt;
			})[0];

			if (!selected) {
				unresolved(t("pr.slotReasonNoCandidates"));
				continue;
			}

			selectedReviewerIds.add(String(selected._id));
			virtualCounts.set(String(selected._id), selected.assignmentCount + 1);
			resolved.push({
				slotIndex,
				reviewer: selected,
				tagId: requiredTagId,
			});
			previews.push({
				slotIndex,
				status: "resolved",
				reviewerName: selected.name,
				tagName: requiredTagId
					? tagNameMap.get(String(requiredTagId))
					: undefined,
			});
		}

		return {
			slots: previews,
			resolved,
			payloadSlots,
		};
	}, [
		currentUserReviewerId,
		effectiveSlotConfigs,
		mode,
		reviewers,
		selectedTagId,
		t,
		tags,
	]);

	const resolvedNamesForMessage = resolvePreview.resolved
		.map((item) => item.reviewer.name)
		.join(", ");

	const handlePrUrlBlur = async () => {
		const trimmedUrl = prUrl.trim();
		if (!trimmedUrl || !teamSlug) {
			setShowDuplicateAlert(false);
			return;
		}

		try {
			const existing = await checkPRAlreadyAssignedAction({
				teamSlug,
				prUrl: trimmedUrl,
			});

			if (existing) {
				setDuplicateAssignment({
					reviewerName: existing.reviewerName,
					timestamp: existing.timestamp,
				});
				setShowDuplicateAlert(true);
			} else {
				setShowDuplicateAlert(false);
			}
		} catch (error) {
			console.error("Error checking for duplicate PR:", error);
		}
	};

	const getActionByReviewerId = () => {
		if (!user?.email) return undefined;
		return reviewers.find(
			(reviewer) => reviewer.email.toLowerCase() === user.email.toLowerCase(),
		)?._id;
	};

	const getAssignerName = () =>
		user?.firstName && user?.lastName
			? `${user.firstName} ${user.lastName}`
			: user?.firstName || user?.lastName || "Unknown";

	const sendAssignmentMessage = async (targetReviewer: Doc<"reviewers">) => {
		if (!(sendMessage && prUrl.trim() && teamSlug)) return;
		try {
			const result = await sendGoogleChatAction({
				reviewerName: targetReviewer.name,
				reviewerEmail: targetReviewer.email,
				reviewerChatId:
					(targetReviewer as unknown as { googleChatUserId?: string })
						.googleChatUserId || undefined,
				prUrl,
				contextUrl: contextUrl.trim() || undefined,
				locale: "es",
				assignerEmail: user?.email,
				assignerName: getAssignerName(),
				teamSlug,
				sendOnlyNames: false,
				customMessage:
					enableCustomMessage && customMessage.trim().length > 0
						? customMessage
						: undefined,
			});
			if (!result.success) {
				console.error("Failed to send Google Chat message:", result.error);
			}
		} catch (error) {
			console.error("Failed to send Google Chat message:", error);
		}
	};

	const handleAssignPR = async () => {
		if (!teamSlug) return;
		setIsAssigning(true);
		setLiveSummary("");
		try {
			const result = await assignPRBatchMutation({
				teamSlug,
				mode,
				selectedTagId: mode === "tag" ? selectedTagId : undefined,
				slots: resolvePreview.payloadSlots.slice(0, effectiveReviewerCount),
				prUrl: prUrl.trim() || undefined,
				contextUrl: contextUrl.trim() || undefined,
				actionByReviewerId: getActionByReviewerId(),
			});

			if (!result.success || result.assignedCount === 0) {
				const message = t("messages.batchAssignFailed");
				setLiveSummary(message);
				toast({
					title: t("common.error"),
					description: message,
					variant: "destructive",
				});
				return;
			}

			if (sendMessage && prUrl.trim() && teamSlug) {
				if (result.assignedCount > 1) {
					const groupResult = await sendGoogleChatGroupAction({
						reviewers: result.assigned.map((item) => {
							const reviewer = reviewers.find(
								(r) => String(r._id) === String(item.reviewer.id),
							);
							return {
								name: item.reviewer.name,
								email: item.reviewer.email,
								reviewerChatId: reviewer?.googleChatUserId,
							};
						}),
						prUrl: prUrl.trim(),
						contextUrl: contextUrl.trim() || undefined,
						locale: "es",
						assignerEmail: user?.email,
						assignerName: getAssignerName(),
						teamSlug,
						customMessage:
							enableCustomMessage && customMessage.trim().length > 0
								? customMessage
								: undefined,
					});
					if (!groupResult.success) {
						console.error(
							"Failed to send group Google Chat message:",
							groupResult.error,
						);
					}
				} else {
					const first = result.assigned[0];
					const target = reviewers.find(
						(reviewer) => String(reviewer._id) === String(first.reviewer.id),
					);
					if (target) {
						await sendAssignmentMessage(target);
					}
				}
			}

			if (result.failedCount > 0) {
				const message = t("messages.batchAssignPartial", {
					assigned: result.assignedCount,
					requested: result.totalRequested,
				});
				setLiveSummary(message);
				toast({
					title: t("common.warning"),
					description: message,
				});
			} else if (result.assignedCount === 1) {
				const message = t("messages.batchAssignSingleSuccess", {
					reviewer: result.assigned[0].reviewer.name,
				});
				setLiveSummary(message);
				toast({
					title: t("common.success"),
					description: message,
				});
			} else {
				const message = t("messages.batchAssignSuccess", {
					count: result.assignedCount,
				});
				setLiveSummary(message);
				toast({
					title: t("common.success"),
					description: message,
				});
			}
		} finally {
			setTimeout(() => setIsAssigning(false), 600);
		}
	};

	const getTagStats = (tagId: Id<"tags">) => {
		const tagReviewers = reviewers.filter((reviewer) =>
			reviewer.tags?.includes(tagId),
		);
		const availableReviewers = tagReviewers.filter(
			(reviewer) => !reviewer.isAbsent,
		);
		return {
			totalReviewers: tagReviewers.length,
			availableReviewers: availableReviewers.length,
		};
	};

	const lastAssignedReviewer = assignmentFeed.lastAssigned?.reviewerId
		? reviewers.find(
				(reviewer) => reviewer._id === assignmentFeed.lastAssigned?.reviewerId,
			)
		: null;

	const isAssignDisabled =
		isAssigning ||
		(sendMessage && !prUrl.trim()) ||
		resolvePreview.resolved.length === 0;

	return (
		<Card className="flex flex-col overflow-hidden">
			<CardHeader className="flex-shrink-0" />
			<CardContent className="flex flex-1 items-center justify-center">
				{activeNextReviewer ? (
					<div className="w-full overflow-hidden py-8 text-center">
						<div className="space-y-6">
							{mode === "regular" && lastAssignedReviewer && (
								<div className="space-y-1">
									<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										{t("pr.lastAssigned")}
									</span>
									<h4
										className={`text-lg font-medium text-muted-foreground opacity-80 transition-opacity duration-300 motion-reduce:transition-none ${
											isAssigning ? "opacity-0" : "opacity-80"
										}`}
									>
										{lastAssignedReviewer.name}
									</h4>
								</div>
							)}

							<div className="space-y-3">
								<div>
									<span className="inline-flex items-center gap-2 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25 dark:bg-white/12 dark:text-white dark:ring-white/20">
										<Sparkles className="h-3 w-3" aria-hidden="true" />
										{mode === "tag"
											? t("tags.nextReviewer")
											: t("pr.nextReviewer")}
									</span>
								</div>
								<div className="relative mx-auto max-w-xl overflow-hidden border border-white/6 bg-gradient-to-br from-primary/20 via-primary/16 to-primary/10 p-7 shadow-md ring-1 ring-primary/14 dark:border-white/5 dark:from-primary/28 dark:via-primary/32 dark:to-primary/20 dark:ring-primary/30">
									<div
										className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.25),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.14),transparent_45%)] dark:bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.08),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(59,130,246,0.22),transparent_45%)]"
										aria-hidden
									/>
									<div className="relative space-y-2">
										<h3
											className={`text-4xl font-bold text-primary drop-shadow-lg transition-transform transition-opacity duration-300 motion-reduce:transition-none md:text-5xl dark:text-white ${
												isAssigning
													? "translate-y-1 opacity-0"
													: "translate-y-0 opacity-100"
											}`}
										>
											{activeNextReviewer.name}
										</h3>
										{mode === "tag" && selectedTag && (
											<div className="flex justify-center">
												<Badge
													variant="secondary"
													style={{
														backgroundColor: `${selectedTag.color}20`,
														color: selectedTag.color,
														borderColor: selectedTag.color,
													}}
												>
													{selectedTag.name}
												</Badge>
											</div>
										)}
									</div>
								</div>
							</div>

							{upcomingReviewer && (
								<div className="space-y-1">
									<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										{t("pr.upNext")}
									</span>
									<h4 className="text-lg font-medium text-muted-foreground opacity-80">
										{upcomingReviewer.name}
									</h4>
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="w-full border-2 border-muted bg-muted p-6 text-center">
						{mode === "tag" ? (
							selectedTagId ? (
								<p className="text-sm text-muted-foreground">
									{isLoadingTagReviewer
										? t("tags.findingNextReviewer")
										: t("tags.noAvailableReviewers")}
								</p>
							) : (
								<p className="text-sm text-muted-foreground">
									{t("tags.selectTag")}
								</p>
							)
						) : (
							<>
								<h3 className="mb-2 text-xl font-medium text-muted-foreground">
									{t("pr.noAvailableReviewersTitle")}
								</h3>
								<p className="text-sm text-muted-foreground">
									{t("pr.allReviewersAbsent")}
								</p>
							</>
						)}
					</div>
				)}
			</CardContent>
			<CardFooter className="flex-shrink-0 space-y-6">
				<div className="w-full space-y-4">
					{tags.length > 0 && (
						<div className="space-y-3 border border-muted bg-muted/30 p-3">
							<div className="grid grid-cols-2 gap-2">
								<Button
									variant={mode === "regular" ? "default" : "outline"}
									size="sm"
									onClick={() => {
										setMode("regular");
										setSelectedTagId(undefined);
									}}
									className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								>
									{t("pr.assignmentModeRegular")}
								</Button>
								<Button
									variant={mode === "tag" ? "default" : "outline"}
									size="sm"
									onClick={() => setMode("tag")}
									className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								>
									{t("pr.assignmentModeWithTags")}
								</Button>
							</div>

							{mode === "tag" && (
								<div className="space-y-2">
									<Label htmlFor="assignment-tag-global">
										{t("tags.selectTag")}
									</Label>
									<Select
										value={selectedTagId}
										onValueChange={(value) =>
											setSelectedTagId(value as Id<"tags">)
										}
									>
										<SelectTrigger
											id="assignment-tag-global"
											className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
										>
											<SelectValue placeholder={t("tags.chooseTag")} />
										</SelectTrigger>
										<SelectContent>
											{tags.map((tag: Doc<"tags">) => {
												const stats = getTagStats(tag._id as Id<"tags">);
												return (
													<SelectItem key={tag._id} value={tag._id}>
														{tag.name} ({stats.availableReviewers}/
														{stats.totalReviewers})
													</SelectItem>
												);
											})}
										</SelectContent>
									</Select>
									<p className="text-xs text-muted-foreground">
										{t("tags.tagBasedDescription")}
									</p>
								</div>
							)}
						</div>
					)}

					<section className="space-y-3 rounded-lg border border-muted bg-muted/20 p-3">
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<Label
										htmlFor="assignment-multi-toggle"
										className="flex items-center gap-2 text-sm"
									>
										<Users
											className="h-4 w-4 text-primary"
											aria-hidden="true"
										/>
										{t("pr.multipleAssignmentToggleLabel")}
									</Label>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-6 w-6 shrink-0 text-muted-foreground"
													aria-label={t(
														"pr.multipleAssignmentToggleDescription",
													)}
												>
													<Info className="h-4 w-4" aria-hidden="true" />
												</Button>
											</TooltipTrigger>
											<TooltipContent className="max-w-64 text-xs">
												<p>{t("pr.multipleAssignmentToggleDescription")}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							</div>
							<Switch
								id="assignment-multi-toggle"
								checked={isMultiAssignmentEnabled}
								onCheckedChange={(value) => {
									setIsMultiAssignmentEnabled(value);
									if (value && reviewerCount < 2) {
										setReviewerCount(2);
									}
								}}
								className="focus-visible:ring-2 focus-visible:ring-primary"
							/>
						</div>
						{isMultiAssignmentEnabled && (
							<div className="flex flex-wrap gap-2" aria-live="polite">
								<Badge variant="secondary" className="max-w-full">
									{t("pr.multipleAssignmentSummaryEnabled", {
										count: reviewerCount,
									})}
								</Badge>
							</div>
						)}
						{isMultiAssignmentEnabled && (
							<ReviewerSlotsConfigurator
								mode={mode}
								reviewerCount={reviewerCount}
								minReviewerCount={2}
								embedded
								selectedTagId={selectedTagId}
								slots={slotConfigs.slice(0, reviewerCount)}
								reviewers={reviewers}
								tags={tags}
								previews={resolvePreview.slots}
								allowReviewerCountChange
								onReviewerCountChange={setReviewerCount}
								onSlotChange={(index, patch) => {
									setSlotConfigs((prev) =>
										prev.map((slot, slotIndex) =>
											slotIndex === index
												? normalizeSlotForMode({ ...slot, ...patch }, mode)
												: slot,
										),
									);
								}}
							/>
						)}
					</section>
					{showDuplicateAlert && duplicateAssignment && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" aria-hidden="true" />
							<AlertDescription>
								{t("messages.duplicatePRAssigned", {
									reviewer: duplicateAssignment.reviewerName,
									date: new Date(
										duplicateAssignment.timestamp,
									).toLocaleDateString(),
								})}
							</AlertDescription>
						</Alert>
					)}

					<section className="space-y-3 rounded-lg border border-muted bg-muted/20 p-3">
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<Label
										htmlFor="assignment-send-message-toggle"
										className="flex items-center gap-2 text-sm"
									>
										<MessageSquare
											className="h-4 w-4 text-primary"
											aria-hidden="true"
										/>
										{t("googleChat.sendMessageToggle")}
									</Label>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-6 w-6 shrink-0 text-muted-foreground"
													aria-label={t("pr.sendMessageToggleDescription")}
												>
													<Info className="h-4 w-4" aria-hidden="true" />
												</Button>
											</TooltipTrigger>
											<TooltipContent className="max-w-64 text-xs">
												<p>{t("pr.sendMessageToggleDescription")}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							</div>
							<Switch
								id="assignment-send-message-toggle"
								checked={sendMessage}
								onCheckedChange={(value) => {
									setSendMessage(value);
									if (!value) {
										setEnableCustomMessage(false);
										setCustomMessage("");
										setShowDuplicateAlert(false);
									}
								}}
								className="focus-visible:ring-2 focus-visible:ring-primary"
							/>
						</div>

						<ChatMessageCustomizer
							prUrl={prUrl}
							onPrUrlChange={(value) => {
								setPrUrl(value);
								if (showDuplicateAlert) setShowDuplicateAlert(false);
							}}
							onPrUrlBlur={handlePrUrlBlur}
							contextUrl={contextUrl}
							onContextUrlChange={setContextUrl}
							sendMessage={sendMessage}
							onSendMessageChange={setSendMessage}
							enabled={enableCustomMessage}
							onEnabledChange={(value) => {
								setEnableCustomMessage(value);
								if (!value) setCustomMessage("");
							}}
							message={customMessage}
							onMessageChange={setCustomMessage}
							nextReviewerName={
								resolvedNamesForMessage || activeNextReviewer?.name
							}
							showSendToggle={false}
							embedded
						/>
					</section>

					{liveSummary && (
						<p className="text-sm text-muted-foreground" aria-live="polite">
							{liveSummary}
						</p>
					)}

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<Button
								onClick={handleAssignPR}
								disabled={isAssignDisabled}
								className="h-12 flex-1 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								size="lg"
							>
								{isAssigning ? t("tags.assigning") : t("pr.assignPR")}
							</Button>

							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="outline"
											size="icon"
											className="h-12 w-12 shrink-0"
											onClick={onUndoAssignment}
											disabled={isAssigning}
										>
											<Undo2 className="h-5 w-5" aria-hidden="true" />
											<span className="sr-only">
												{t("pr.undoLastAssignment")}
											</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>{t("pr.undoLastAssignment")}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>
				</div>
			</CardFooter>
		</Card>
	);
}
