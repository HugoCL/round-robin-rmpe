"use client";

import { useAction, useMutation, useQueries, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { resolveAssignerDisplayName } from "@/lib/assignerDisplayName";
import { resolveBroadcastTeamSlugs } from "@/lib/chatBroadcast";
import { buildCrossTeamReviewerPool } from "@/lib/crossTeamPool";
import { parsePrUrl } from "@/lib/prUrl";
import { isEligibleForAssignment } from "@/lib/reviewerEligibility";
import type { Reviewer } from "@/lib/types";
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
	rotationQueue,
} from "./assignment/assignmentCard.utils";
import type { ReviewerSlotConfig } from "./assignment/ReviewerSlotsConfigurator";
import { RotationMenu } from "./assignment/RotationMenu";
import { resolveAssignmentPreview } from "./assignment/resolveAssignmentPreview";
import { lastAssignmentUndoCopy } from "./assignment/undoCopy";
import { ForceAssignDialog } from "./dialogs/ForceAssignDialog";
import {
	CHAT_OUTCOME_MESSAGE_KEYS,
	type ChatSend,
	useChatNotice,
} from "./hooks/useChatNotice";
import { useDuplicatePrCheck } from "./hooks/useDuplicatePrCheck";
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
	const [reviewerCount, setReviewerCount] = useState(1);
	const [slotConfigs, setSlotConfigs] = useState<ReviewerSlotConfig[]>([
		defaultSlotForMode("regular"),
	]);
	const [liveSummary, setLiveSummary] = useState<{
		text: string;
		batchId?: string;
	}>({ text: "" });
	const [prUrlTouched, setPrUrlTouched] = useState(false);
	const isMultiAssignmentActive =
		!hideMultiAssignmentSection && isMultiAssignmentEnabled;

	const tagsQuery = useQuery(
		api.queries.getTags,
		teamSlug ? { teamSlug } : "skip",
	);
	const tags = useMemo(() => tagsQuery ?? [], [tagsQuery]);
	// Remembered per team. A tag that no longer exists falls back to the
	// general rotation; the rotation is whichever tag is chosen.
	const [storedTagId, setStoredTagId] = useLocalStorage<Id<"tags"> | null>(
		`la-lista-assignment-tag:${teamSlug ?? ""}`,
		null,
	);
	const selectedTagId =
		storedTagId && tags.some((tag) => tag._id === storedTagId)
			? storedTagId
			: undefined;
	const mode: AssignmentMode = selectedTagId ? "tag" : "regular";
	const [forceAssignOpen, setForceAssignOpen] = useState(false);
	const setSelectedTagId = (tagId: Id<"tags"> | undefined) =>
		setStoredTagId(tagId ?? null);
	const team = useQuery(api.queries.getTeam, teamSlug ? { teamSlug } : "skip");
	const assignmentHistory = useQuery(
		api.queries.getAssignmentHistory,
		teamSlug ? { teamSlug } : "skip",
	);
	const allTeams = useQuery(api.queries.getTeams);
	// Memoized on the query result itself: a fresh `[]` per render while it
	// loads would re-run the effects that depend on this list.
	const availableCrossTeamTargets = useMemo(
		() =>
			(allTeams ?? []).filter(
				(team): team is NonNullable<NonNullable<typeof allTeams>[number]> =>
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
			// A new `[]` on every pass would re-trigger this effect forever.
			if (selectedCrossTeamSlugs.length > 0) setSelectedCrossTeamSlugs([]);
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
		setLiveSummary({ text: "" });
	}, [configurationHash]);

	// Across teams the server picks from the chosen teams' reviewers (and not
	// this team's when its chip is off), so the preview needs that same pool.
	const crossTeamActive = crossTeamReview && selectedCrossTeamSlugs.length > 0;
	// useQueries builds its subscription from the request object's identity and
	// swapping it sets state during render: a fresh object per render loops.
	const crossTeamRequests = useMemo(
		() =>
			Object.fromEntries(
				(crossTeamActive ? selectedCrossTeamSlugs : []).map((slug) => [
					slug,
					{ query: api.queries.getReviewers, args: { teamSlug: slug } },
				]),
			),
		[crossTeamActive, selectedCrossTeamSlugs],
	);
	const crossTeamResults = useQueries(crossTeamRequests);
	const crossTeamLists = selectedCrossTeamSlugs.map(
		(slug) => crossTeamResults[slug] as Reviewer[] | Error | undefined,
	);
	// A list that failed to load also leaves the pool unknown: no name is shown.
	const isLoadingCrossTeam =
		crossTeamActive && !crossTeamLists.every((list) => Array.isArray(list));
	const crossTeamPool =
		crossTeamActive && !isLoadingCrossTeam
			? buildCrossTeamReviewerPool({
					sourceTeamSlug: teamSlug ?? "",
					sourceReviewers: reviewers,
					additionalTeams: selectedCrossTeamSlugs.map((slug, index) => ({
						teamSlug: slug,
						reviewers: crossTeamLists[index] as Reviewer[],
					})),
					excludeTeammates,
				})
			: null;
	const poolReviewers = crossTeamPool?.reviewers ?? reviewers;
	const otherTeamNameByReviewerId = new Map<string, string>();
	for (const [reviewerId, slug] of crossTeamPool?.teamSlugByReviewerId ?? []) {
		const name = availableCrossTeamTargets.find(
			(target) => target.slug === slug,
		)?.name;
		if (slug !== teamSlug && name)
			otherTeamNameByReviewerId.set(reviewerId, name);
	}

	const currentUserReviewerId = useMemo(() => {
		if (!user?.email) return undefined;
		return reviewers.find(
			(reviewer) => reviewer.email.toLowerCase() === user.email.toLowerCase(),
		)?._id as Id<"reviewers"> | undefined;
	}, [reviewers, user?.email]);

	const isLoadingTagReviewer =
		mode === "tag" &&
		!!selectedTagId &&
		typeof nextReviewerByTag === "undefined";
	const availableReviewersForMode = useMemo(() => {
		if (mode !== "tag") {
			return poolReviewers.filter((reviewer) =>
				isEligibleForAssignment(reviewer),
			);
		}
		if (!selectedTagId) return [];
		return poolReviewers.filter((reviewer) =>
			isEligibleForAssignment(reviewer, selectedTagId),
		);
	}, [mode, poolReviewers, selectedTagId]);
	// The server's next-reviewer queries only know this team; across teams the
	// pool's queue gives the same pick.
	const activeNextReviewer = crossTeamActive
		? (rotationQueue(availableReviewersForMode, [])[0] ?? null)
		: mode === "tag"
			? (nextReviewerByTag ?? null)
			: nextReviewer;
	const upcomingReviewer = useMemo(() => {
		if (!activeNextReviewer) return null;
		return findUpcomingAfterCurrent(
			availableReviewersForMode,
			activeNextReviewer._id as Id<"reviewers">,
		);
	}, [activeNextReviewer, availableReviewersForMode]);
	// The viewer is skipped when they are next, so who follows the receiver
	// leaves them out too.
	const upcomingAfterReceiver = useMemo(() => {
		const isSelfNext =
			!!currentUserReviewerId &&
			activeNextReviewer?._id === currentUserReviewerId;
		const receiver = isSelfNext ? upcomingReviewer : activeNextReviewer;
		if (!receiver) return null;
		return (
			rotationQueue(availableReviewersForMode, [
				receiver._id,
				isSelfNext ? currentUserReviewerId : null,
			])[0] ?? null
		);
	}, [
		activeNextReviewer,
		availableReviewersForMode,
		currentUserReviewerId,
		upcomingReviewer,
	]);
	// Switching tags or teams reloads the pick. Until it lands, the hero shows
	// the last complete picture (dimmed): name and "then" together, never one
	// from each, and never an empty line that would push the card around.
	const isLoadingPicks = isLoadingTagReviewer || isLoadingCrossTeam;
	const heroPicks = {
		activeNextReviewer,
		upcomingReviewer,
		upcomingAfterReceiver,
		otherTeamNameByReviewerId,
	};
	const lastHeroPicksRef = useRef(heroPicks);
	if (!isLoadingPicks) lastHeroPicksRef.current = heroPicks;
	const heroShown = isLoadingPicks ? lastHeroPicksRef.current : heroPicks;

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
				reviewers: poolReviewers,
				tags,
				selectedTagId,
				currentUserReviewerId,
				reasonMessages: resolverReasonMessages,
			}),
		[
			mode,
			effectiveSlotConfigs,
			poolReviewers,
			tags,
			selectedTagId,
			currentUserReviewerId,
			resolverReasonMessages,
		],
	);

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

	// The action posts to the webhook of the source team and of every team in
	// the broadcast; with none of them configured it can only fail, and that
	// failure would surface as a false warning after every assignment.
	const canNotifyChat = (broadcastTeamSlugs: string[] | undefined) =>
		[teamSlug, ...(broadcastTeamSlugs ?? [])].some((slug) => {
			const target =
				slug === teamSlug
					? team
					: allTeams?.find((candidate) => candidate?.slug === slug);
			return target?.hasGoogleChatWebhook !== false;
		});

	const chatDelivery = useChatNotice();

	const handleAssignPR = async () => {
		if (!teamSlug) return;

		setIsAssigning(true);
		setLiveSummary({ text: "" });
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
				setLiveSummary({ text: message });
				toast({
					title: t("common.error"),
					description: message,
					variant: "destructive",
				});
				return;
			}

			const chatTeams = broadcastTeamSlugsFor(result.assigned);
			let chatSend: ChatSend | null = null;
			if (prUrl.trim() && teamSlug && canNotifyChat(chatTeams)) {
				const chatCustomMessage =
					enableCustomMessage && customMessage.trim().length > 0
						? customMessage
						: undefined;
				if (result.assignedCount > 1) {
					const payload = {
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
						broadcastTeamSlugs: chatTeams,
						urgent,
						customMessage: chatCustomMessage,
					};
					chatSend = () => sendGoogleChatGroupAction(payload);
				} else {
					const targetReviewer = result.assigned[0].reviewer;
					const payload = {
						reviewerName: targetReviewer.name,
						reviewerEmail: targetReviewer.email,
						reviewerChatId: targetReviewer.googleChatUserId || undefined,
						prUrl,
						contextUrl: contextUrl.trim() || undefined,
						locale: "es",
						assignerEmail: user?.email,
						assignerName: getAssignerName(),
						teamSlug,
						broadcastTeamSlugs: chatTeams,
						sendOnlyNames: false,
						urgent,
						customMessage: chatCustomMessage,
					};
					chatSend = () => sendGoogleChatAction(payload);
				}
			}

			const prNumber = parsePrUrl(prUrl)?.number;
			const firstReviewer = result.assigned[0].reviewer.name;
			const assignedText =
				result.failedCount > 0
					? t("messages.batchAssignPartial", {
							assigned: result.assignedCount,
							requested: result.totalRequested,
						})
					: result.assignedCount > 1
						? t("messages.batchAssignSuccess", { count: result.assignedCount })
						: prNumber
							? t("messages.batchAssignSingleSuccessWithPr", {
									number: prNumber,
									reviewer: firstReviewer,
								})
							: t("messages.batchAssignSingleSuccess", {
									reviewer: firstReviewer,
								});
			// One toast with the whole outcome: a second one for the chat would
			// replace this one (the toaster shows one at a time), or vice versa.
			const chatOutcome = chatSend ? await chatDelivery.send(chatSend) : null;
			const message =
				chatOutcome === null
					? assignedText
					: `${assignedText} ${t(CHAT_OUTCOME_MESSAGE_KEYS[chatOutcome], {
							count: result.assignedCount,
						})}`;
			setLiveSummary({ text: message, batchId: result.batchId });
			toast(
				chatOutcome === "failed" && chatSend
					? {
							title: t("common.warning"),
							description: message,
							variant: "destructive",
							action: chatDelivery.retryAction(chatSend),
							// A retry nobody saw is a notice nobody got; it stays until dismissed.
							duration: Number.POSITIVE_INFINITY,
						}
					: result.failedCount > 0 || chatOutcome === "partial"
						? { title: t("common.warning"), description: message }
						: { description: message },
			);
			resetMessageState();
			// Enter now submits, so a PR that stayed in the field would be one
			// keystroke away from being assigned twice.
			setPrUrlTouched(false);
			setPrUrl("");
			setContextUrl("");
			setUrgent(false);
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

	// A pasted PR link is the one required input, so it is validated as you type
	// instead of after the assignment has already notified someone.
	const parsedPrUrl = useMemo(() => parsePrUrl(prUrl), [prUrl]);
	// Flag a bad link once it is clearly meant as one (pasted, long enough, has a
	// slash) or once the person leaves the field or tries to assign; not on the
	// first keystroke.
	const trimmedPrUrl = prUrl.trim();
	const hasPrUrlError =
		trimmedPrUrl.length > 0 &&
		parsedPrUrl === null &&
		(prUrlTouched || trimmedPrUrl.length >= 8 || trimmedPrUrl.includes("/"));

	const duplicateCheck = useDuplicatePrCheck(teamSlug, prUrl);

	const isAssignDisabled =
		isAssigning ||
		!parsedPrUrl ||
		(mode === "tag" && !selectedTagId) ||
		(crossTeamReview && selectedCrossTeamSlugs.length === 0) ||
		resolvedPreview.resolved.length === 0;

	// A disabled primary action always says what is missing.
	const assignBlockedReason = (() => {
		if (isAssigning || !isAssignDisabled) return null;
		if (!prUrl.trim()) return t("pr.assignDisabledNeedsUrl");
		// The field's format error and the hint under the team chips already say
		// it in place; repeating them here would say the same thing twice.
		if (hasPrUrlError) return null;
		if (!parsedPrUrl) return t("pr.assignDisabledNeedsUrl");
		if (crossTeamReview && selectedCrossTeamSlugs.length === 0) return null;
		if (resolvedPreview.resolved.length === 0)
			return t("pr.assignDisabledNoReviewer");
		return null;
	})();

	const submittingRef = useRef(false);
	const handleSubmit = async () => {
		setPrUrlTouched(true);
		if (isAssignDisabled || submittingRef.current) return;
		submittingRef.current = true;
		try {
			// The first attempt on an already-assigned PR only surfaces the warning.
			await duplicateCheck.submit(handleAssignPR);
		} finally {
			submittingRef.current = false;
		}
	};

	// Undo, here, with U or from the history, takes the batch back and its line too.
	const isSummaryUndone =
		!!liveSummary.batchId &&
		!!assignmentHistory &&
		!assignmentHistory.some((entry) => entry.batchId === liveSummary.batchId);

	const receivers = resolvedPreview.resolved;
	// Until the other teams' reviewers load, a name would come from this team only.
	const namedReceiver =
		receivers.length === 1 && !isLoadingCrossTeam ? receivers[0] : null;
	// The rotation landed on the person who already has this PR; say so and
	// offer the way to pick someone else instead of a silent second notice.
	const duplicateIsReceiver =
		namedReceiver !== null &&
		namedReceiver.reviewer.name === duplicateCheck.duplicate?.reviewerName;
	const isReassigning = duplicateCheck.duplicate !== null;
	const assignLabel =
		receivers.length > 1
			? t(isReassigning ? "pr.assignAgainToCount" : "pr.assignToCount", {
					count: receivers.length,
				})
			: namedReceiver
				? t(
						duplicateIsReceiver
							? "pr.assignAgainToSame"
							: isReassigning
								? "pr.assignAlsoTo"
								: "pr.assignTo",
						{
							name: namedReceiver.reviewer.name,
						},
					)
				: t(isReassigning ? "pr.assignAgainShort" : "pr.assignPR");
	// The webhook checked here is this team's; across teams each chosen team's
	// channel is notified, which the toast reports after assigning.
	const chatNotice =
		!team?.hasGoogleChatWebhook || crossTeamReview
			? null
			: receivers.length > 1
				? t("pr.chatNoticeCount", { count: receivers.length })
				: namedReceiver
					? t("pr.chatNotice", { name: namedReceiver.reviewer.name })
					: null;

	return (
		<Card className="calm-shell gap-0 overflow-clip py-0 ring-0">
			<CardContent className="group/assign flex flex-col gap-5 px-4 pt-4 sm:px-5 sm:pt-5 lg:gap-6 lg:px-6 lg:pt-6">
				<AssignmentHeroPanel
					mode={mode}
					isAssigning={isAssigning || isLoadingPicks}
					activeNextReviewer={heroShown.activeNextReviewer}
					otherTeamNameByReviewerId={heroShown.otherTeamNameByReviewerId}
					currentUserReviewerId={currentUserReviewerId}
					upcomingReviewer={heroShown.upcomingReviewer}
					upcomingAfterReceiver={heroShown.upcomingAfterReceiver}
					multipleReceivers={
						isMultiAssignmentActive
							? resolvedPreview.resolved.map((item) => item.reviewer)
							: null
					}
					isLoadingTagReviewer={isLoadingTagReviewer}
					rotationMenu={
						<RotationMenu
							tags={tags}
							selectedTagId={selectedTagId}
							onTagChange={setSelectedTagId}
							onPickSomeoneElse={() => setForceAssignOpen(true)}
							getTagStats={getTagStats}
						/>
					}
				/>
				<ForceAssignDialog
					trigger={null}
					open={forceAssignOpen}
					onOpenChange={setForceAssignOpen}
					draft={{ prUrl, contextUrl, urgent }}
					onAssigned={() => {
						setPrUrl("");
						setContextUrl("");
						setUrgent(false);
					}}
				/>

				<hr className="border-border/60" />

				<AssignmentControlsPanel
					onSubmit={handleSubmit}
					tags={tags}
					mode={mode}
					selectedTagId={selectedTagId}
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
					currentTeam={
						teamSlug && team ? { slug: teamSlug, name: team.name } : null
					}
					selectedCrossTeamSlugs={selectedCrossTeamSlugs}
					onSelectedCrossTeamSlugsChange={setSelectedCrossTeamSlugs}
					excludeTeammates={excludeTeammates}
					onExcludeTeammatesChange={setExcludeTeammates}
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
					onPrUrlBlur={() => setPrUrlTouched(true)}
					onPrUrlChange={(value) => {
						setPrUrl(value);
						if (!value.trim()) setPrUrlTouched(false);
						// The last result belongs to the previous PR, not this one.
						setLiveSummary({ text: "" });
					}}
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
					duplicateAssignment={duplicateCheck.duplicate}
					duplicateIsReceiver={duplicateIsReceiver}
					parsedPrUrl={parsedPrUrl}
					hasPrUrlError={hasPrUrlError}
					blockedReason={assignBlockedReason}
				/>

				<div className="pt-1 pb-4 sm:pb-5 lg:pb-6">
					<AssignmentActionsRow
						isAssigning={isAssigning}
						isAssignDisabled={isAssignDisabled}
						assignLabel={assignLabel}
						assignShortLabel={t(
							isReassigning ? "pr.assignAgainShort" : "pr.assignShort",
						)}
						chatNotice={chatNotice}
						liveSummary={isSummaryUndone ? "" : liveSummary.text}
						canUndo={assignmentFeed.items.length > 0}
						enterAssigns={!isReassigning}
						deemphasize={duplicateIsReceiver}
						undoCopy={lastAssignmentUndoCopy(
							t,
							assignmentFeed.items,
							assignmentHistory,
						)}
						onUndoAssignment={onUndoAssignment}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
