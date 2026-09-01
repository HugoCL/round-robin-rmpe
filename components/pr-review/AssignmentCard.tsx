"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { resolveAssignerDisplayName } from "@/lib/assignerDisplayName";
import { resolveBroadcastTeamSlugs } from "@/lib/chatBroadcast";
import { isEligibleForAssignment } from "@/lib/reviewerEligibility";
import { AssignmentActionsRow } from "./assignment/AssignmentActionsRow";
import { AssignmentControlsPanel } from "./assignment/AssignmentControlsPanel";
import { AssignmentHeroPanel } from "./assignment/AssignmentHeroPanel";
import type {
	AssignmentMode,
	AssignmentResolverReasonMessages,
	AssignPRBatchAssignedItem,
} from "./assignment/assignmentCard.types";
import {
	defaultSlotForMode,
	findUpcomingAfterCurrent,
	normalizeSlotForMode,
} from "./assignment/assignmentCard.utils";
import type { ReviewerSlotConfig } from "./assignment/ReviewerSlotsConfigurator";
import { resolveAssignmentPreview } from "./assignment/resolveAssignmentPreview";
import { usePRReview } from "./PRReviewContext";

export function AssignmentCard() {
	const t = useTranslations();
	const {
		teamSlug,
		nextReviewer,
		reviewers,
		assignmentFeed,
		undoAssignment: onUndoAssignment,
		userInfo: user,
		hideMultiAssignmentSection,
	} = usePRReview();

	const [isAssigning, setIsAssigning] = useState(false);
	const [isMultiAssignmentEnabled, setIsMultiAssignmentEnabled] =
		useState(false);
	const [prUrl, setPrUrl] = useState("");
	const [contextUrl, setContextUrl] = useState("");
	const [urgent, setUrgent] = useState(false);
	const [crossTeamReview, setCrossTeamReview] = useState(false);
	const [excludeTeammates, setExcludeTeammates] = useState(false);
	const [selectedCrossTeamSlugs, setSelectedCrossTeamSlugs] = useState<
		string[]
	>([]);
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
	const isMultiAssignmentActive =
		!hideMultiAssignmentSection && isMultiAssignmentEnabled;
	const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
	const [duplicateAssignment, setDuplicateAssignment] = useState<{
		reviewerName: string;
		timestamp: number;
	} | null>(null);

	const tags =
		useQuery(api.queries.getTags, teamSlug ? { teamSlug } : "skip") || [];
	const allTeams = useQuery(api.queries.getTeams) || [];
	const availableCrossTeamTargets = useMemo(
		() =>
			allTeams.filter(
				(team): team is NonNullable<(typeof allTeams)[number]> =>
					team !== null &&
					typeof team.slug === "string" &&
					team.slug !== teamSlug,
			),
		[allTeams, teamSlug],
	);
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
		if (hideMultiAssignmentSection && isMultiAssignmentEnabled) {
			setIsMultiAssignmentEnabled(false);
			setReviewerCount(1);
			setSlotConfigs([defaultSlotForMode(mode)]);
		}
	}, [hideMultiAssignmentSection, isMultiAssignmentEnabled, mode]);

	useEffect(() => {
		if (!crossTeamReview && selectedCrossTeamSlugs.length > 0) {
			setSelectedCrossTeamSlugs([]);
			return;
		}
		if (!crossTeamReview && excludeTeammates) {
			setExcludeTeammates(false);
		}
		if (crossTeamReview && availableCrossTeamTargets.length === 0) {
			setSelectedCrossTeamSlugs([]);
			return;
		}
		if (selectedCrossTeamSlugs.length === 0) {
			return;
		}
		const allowedSlugs = new Set<string>();
		for (const candidate of availableCrossTeamTargets) {
			if (candidate?.slug) {
				allowedSlugs.add(candidate.slug);
			}
		}
		const filtered = selectedCrossTeamSlugs.filter((slug) =>
			allowedSlugs.has(slug),
		);
		if (filtered.length !== selectedCrossTeamSlugs.length) {
			setSelectedCrossTeamSlugs(filtered);
		}
	}, [
		availableCrossTeamTargets,
		crossTeamReview,
		excludeTeammates,
		selectedCrossTeamSlugs,
	]);

	useEffect(() => {
		if (!crossTeamReview) return;
		if (selectedCrossTeamSlugs.length > 0) return;
		if (availableCrossTeamTargets.length !== 1) return;
		const onlyTeamSlug = availableCrossTeamTargets[0]?.slug;
		if (typeof onlyTeamSlug !== "string" || onlyTeamSlug.length === 0) return;
		setSelectedCrossTeamSlugs([onlyTeamSlug]);
	}, [availableCrossTeamTargets, crossTeamReview, selectedCrossTeamSlugs]);

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

	const effectiveReviewerCount = isMultiAssignmentActive ? reviewerCount : 1;
	const effectiveSlotConfigs = useMemo(() => {
		const normalized = slotConfigs.map((slot) =>
			normalizeSlotForMode(slot, mode),
		);
		if (isMultiAssignmentActive) {
			return normalized.slice(0, reviewerCount);
		}
		return [normalized[0] ?? defaultSlotForMode(mode)];
	}, [isMultiAssignmentActive, mode, reviewerCount, slotConfigs]);

	const configurationHash = useMemo(
		() =>
			JSON.stringify({
				mode,
				isMultiAssignmentEnabled: isMultiAssignmentActive,
				reviewerCount: effectiveReviewerCount,
				excludeTeammates,
				selectedTagId: selectedTagId ? String(selectedTagId) : null,
				slots: effectiveSlotConfigs.map((slot) => ({
					id: slot.id,
					strategy: slot.strategy,
					reviewerId: slot.reviewerId ? String(slot.reviewerId) : null,
					tagId: slot.tagId ? String(slot.tagId) : null,
				})),
			}),
		[
			effectiveReviewerCount,
			effectiveSlotConfigs,
			isMultiAssignmentActive,
			mode,
			excludeTeammates,
			selectedTagId,
		],
	);

	useEffect(() => {
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
		if (mode !== "tag") {
			return reviewers.filter((reviewer) => isEligibleForAssignment(reviewer));
		}
		if (!selectedTagId) return [];
		return reviewers.filter((reviewer) =>
			isEligibleForAssignment(reviewer, selectedTagId),
		);
	}, [mode, reviewers, selectedTagId]);
	const upcomingReviewer = useMemo(() => {
		if (!activeNextReviewer) return null;
		return findUpcomingAfterCurrent(
			availableReviewersForMode,
			activeNextReviewer._id as Id<"reviewers">,
		);
	}, [activeNextReviewer, availableReviewersForMode]);

	const resolverReasonMessages = useMemo<AssignmentResolverReasonMessages>(
		() => ({
			missingReviewer: t("pr.slotReasonMissingReviewer"),
			reviewerNotFound: t("pr.slotReasonReviewerNotFound"),
			reviewerAbsent: t("pr.slotReasonReviewerAbsent"),
			duplicateReviewer: t("pr.slotReasonDuplicateReviewer"),
			invalidStrategy: t("pr.slotReasonInvalidStrategy"),
			missingSelectedTag: t("pr.slotReasonMissingSelectedTag"),
			missingTag: t("pr.slotReasonMissingTag"),
			noCandidates: t("pr.slotReasonNoCandidates"),
		}),
		[t],
	);

	const resolvedPreview = useMemo(
		() =>
			resolveAssignmentPreview({
				mode,
				slotConfigs: effectiveSlotConfigs,
				reviewers,
				tags,
				selectedTagId,
				currentUserReviewerId,
				reasonMessages: resolverReasonMessages,
			}),
		[
			mode,
			effectiveSlotConfigs,
			reviewers,
			tags,
			selectedTagId,
			currentUserReviewerId,
			resolverReasonMessages,
		],
	);

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

	const getAssignerName = () => {
		const selfReviewer = user?.email
			? reviewers.find(
					(reviewer) =>
						reviewer.email.toLowerCase() === user.email.toLowerCase(),
				)
			: undefined;
		return resolveAssignerDisplayName({
			email: user?.email,
			firstName: user?.firstName,
			lastName: user?.lastName,
			fullName: user?.fullName,
			reviewerName: selfReviewer?.name,
		});
	};

	const resetMessageState = () => {
		setEnableCustomMessage(false);
		setCustomMessage("");
		setShowDuplicateAlert(false);
	};

	// Cross-team assignments must reach both the requesting team channel and the
	// channel of every team a reviewer was actually taken from, so broadcast
	// targets come from the assigned reviewers rather than the candidate pool.
	const broadcastTeamSlugsFor = (
		assignedItems: AssignPRBatchAssignedItem[],
	) => {
		const slugs = resolveBroadcastTeamSlugs({
			sourceTeamSlug: teamSlug,
			reviewerTeamSlugs: assignedItems.map((item) => item.reviewer.teamSlug),
		});
		return slugs.length > 0 ? slugs : undefined;
	};

	const notifyChatFailure = (error?: string) => {
		console.error("Failed to send Google Chat message:", error);
		toast({
			title: t("common.warning"),
			description: t("messages.chatNotificationFailed"),
			variant: "destructive",
		});
	};

	const sendAssignmentMessage = async (
		assignedItem: AssignPRBatchAssignedItem,
	) => {
		if (!(prUrl.trim() && teamSlug)) return;
		const targetReviewer = assignedItem.reviewer;
		try {
			const result = await sendGoogleChatAction({
				reviewerName: targetReviewer.name,
				reviewerEmail: targetReviewer.email,
				reviewerChatId: targetReviewer.googleChatUserId || undefined,
				prUrl,
				contextUrl: contextUrl.trim() || undefined,
				locale: "es",
				assignerEmail: user?.email,
				assignerName: getAssignerName(),
				teamSlug,
				broadcastTeamSlugs: broadcastTeamSlugsFor([assignedItem]),
				sendOnlyNames: false,
				urgent,
				customMessage:
					enableCustomMessage && customMessage.trim().length > 0
						? customMessage
						: undefined,
			});
			if (!result.success) {
				notifyChatFailure(result.error);
			}
		} catch (error) {
			notifyChatFailure(
				error instanceof Error ? error.message : "Unknown error",
			);
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
				slots: resolvedPreview.payloadSlots.slice(0, effectiveReviewerCount),
				prUrl: prUrl.trim() || undefined,
				contextUrl: contextUrl.trim() || undefined,
				urgent,
				crossTeamReview,
				excludeTeammates,
				additionalTeamSlugs: crossTeamReview
					? selectedCrossTeamSlugs
					: undefined,
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

			if (prUrl.trim()) {
				if (result.assignedCount > 1) {
					const groupResult = await sendGoogleChatGroupAction({
						reviewers: result.assigned.map(
							(item: AssignPRBatchAssignedItem) => ({
								name: item.reviewer.name,
								email: item.reviewer.email,
								reviewerChatId: item.reviewer.googleChatUserId,
							}),
						),
						prUrl: prUrl.trim(),
						contextUrl: contextUrl.trim() || undefined,
						locale: "es",
						assignerEmail: user?.email,
						assignerName: getAssignerName(),
						teamSlug,
						broadcastTeamSlugs: broadcastTeamSlugsFor(result.assigned),
						urgent,
						customMessage:
							enableCustomMessage && customMessage.trim().length > 0
								? customMessage
								: undefined,
					});
					if (!groupResult.success) {
						notifyChatFailure(groupResult.error);
					}
				} else {
					await sendAssignmentMessage(result.assigned[0]);
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
			resetMessageState();
		} finally {
			setIsAssigning(false);
		}
	};

	const getTagStats = (tagId: Id<"tags">) => {
		const tagReviewers = reviewers.filter((reviewer) =>
			reviewer.tags?.includes(tagId),
		);
		const availableReviewers = tagReviewers.filter((reviewer) =>
			isEligibleForAssignment(reviewer, tagId),
		);
		return {
			totalReviewers: tagReviewers.length,
			availableReviewers: availableReviewers.length,
		};
	};

	const lastAssignedReviewer = assignmentFeed.lastAssigned?.reviewerId
		? reviewers.find(
				(reviewer) => reviewer._id === assignmentFeed.lastAssigned?.reviewerId,
			) || null
		: null;

	const isAssignDisabled =
		isAssigning ||
		!prUrl.trim() ||
		(crossTeamReview && selectedCrossTeamSlugs.length === 0) ||
		resolvedPreview.resolved.length === 0;

	return (
		<Card className="calm-shell flex flex-col gap-0 overflow-hidden py-0 ring-0">
			<CardHeader className="sr-only">
				<CardTitle>{t("pr.nextReviewer")}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 items-center justify-center px-3 pt-1 sm:px-5 sm:pt-3 md:px-6 md:pt-4 2xl:px-8">
				<AssignmentHeroPanel
					mode={mode}
					lastAssignedReviewer={lastAssignedReviewer}
					isAssigning={isAssigning}
					activeNextReviewer={activeNextReviewer}
					selectedTag={selectedTag}
					userEmail={user?.email}
					upcomingReviewer={upcomingReviewer}
					selectedTagId={selectedTagId}
					isLoadingTagReviewer={isLoadingTagReviewer}
				/>
			</CardContent>
			<CardFooter className="flex-shrink-0 border-t border-border/60 px-3 py-2 sm:px-5 sm:py-4 md:px-6 2xl:px-8">
				<div className="calm-subtle-panel flex w-full flex-col gap-3 p-1.5 sm:p-3 lg:gap-4 lg:p-4">
					<AssignmentControlsPanel
						tags={tags}
						mode={mode}
						selectedTagId={selectedTagId}
						onModeChange={(nextMode) => {
							if (nextMode === "regular") {
								setMode("regular");
								setSelectedTagId(undefined);
								return;
							}
							setMode("tag");
						}}
						onTagChange={(tagId) => setSelectedTagId(tagId as Id<"tags">)}
						getTagStats={getTagStats}
						hideMultiAssignmentSection={hideMultiAssignmentSection}
						isMultiAssignmentEnabled={isMultiAssignmentEnabled}
						reviewerCount={reviewerCount}
						onMultiAssignmentToggle={(enabled) => {
							setIsMultiAssignmentEnabled(enabled);
							if (enabled) {
								if (reviewerCount < 2) {
									setReviewerCount(2);
								}
								return;
							}
							setReviewerCount(1);
							setSlotConfigs([defaultSlotForMode(mode)]);
						}}
						urgent={urgent}
						onUrgentChange={setUrgent}
						crossTeamReview={crossTeamReview}
						onCrossTeamReviewChange={setCrossTeamReview}
						availableCrossTeamTargets={availableCrossTeamTargets}
						selectedCrossTeamSlugs={selectedCrossTeamSlugs}
						onSelectedCrossTeamSlugsChange={setSelectedCrossTeamSlugs}
						excludeTeammates={excludeTeammates}
						onExcludeTeammatesChange={setExcludeTeammates}
						showReviewerSlots={
							!hideMultiAssignmentSection && isMultiAssignmentEnabled
						}
						reviewers={reviewers}
						slotConfigs={slotConfigs}
						reviewerSlotPreviews={resolvedPreview.slots}
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
						prUrl={prUrl}
						onPrUrlChange={(value) => {
							setPrUrl(value);
							if (showDuplicateAlert) setShowDuplicateAlert(false);
						}}
						onPrUrlBlur={handlePrUrlBlur}
						contextUrl={contextUrl}
						onContextUrlChange={setContextUrl}
						enableCustomMessage={enableCustomMessage}
						onEnableCustomMessageChange={(value) => {
							setEnableCustomMessage(value);
							if (!value) setCustomMessage("");
						}}
						customMessage={customMessage}
						onCustomMessageChange={setCustomMessage}
						resolvedPreview={resolvedPreview}
						activeNextReviewer={activeNextReviewer}
						showDuplicateAlert={showDuplicateAlert}
						duplicateAssignment={duplicateAssignment}
					/>

					<AssignmentActionsRow
						isAssigning={isAssigning}
						isAssignDisabled={isAssignDisabled}
						liveSummary={liveSummary}
						onAssign={handleAssignPR}
						onUndoAssignment={onUndoAssignment}
					/>
				</div>
			</CardFooter>
		</Card>
	);
}
