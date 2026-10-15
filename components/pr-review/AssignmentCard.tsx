"use client";

import { useAction, useMutation, useQueries, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { resolveAssignerDisplayName } from "@/lib/assignerDisplayName";
import { resolveBroadcastTeamSlugs } from "@/lib/chatBroadcast";
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
	const locale = useLocale();
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
				selectedTagId: selectedTagId ? String(selectedTagId) : null,
				slots: effectiveSlotConfigs.map((slot) => ({
					id: slot.id,
					strategy: slot.strategy,
					reviewerId: slot.reviewerId ? String(slot.reviewerId) : null,
					tagId: slot.tagId ? String(slot.tagId) : null,
					teamSlug: slot.teamSlug ?? null,
				})),
			}),
		[
			effectiveReviewerCount,
			effectiveSlotConfigs,
			isMultiAssignmentActive,
			mode,
			selectedTagId,
		],
	);

	useEffect(() => {
		void configurationHash;
		setLiveSummary({ text: "" });
	}, [configurationHash]);

	// A reviewer can come from another team, picked by that team's rotation; the
	// preview loads those teams' reviewers to name who it will be.
	const crossTeamSlugs = [
		...new Set(
			effectiveSlotConfigs.flatMap((slot) =>
				slot.teamSlug ? [slot.teamSlug] : [],
			),
		),
	];
	const crossTeamActive = crossTeamSlugs.length > 0;
	const crossTeamKey = crossTeamSlugs.join(",");
	// useQueries builds its subscription from the request object's identity and
	// swapping it sets state during render: a fresh object per render loops.
	const crossTeamRequests = useMemo(
		() =>
			Object.fromEntries(
				crossTeamKey
					.split(",")
					.filter(Boolean)
					.map((slug) => [
						slug,
						{ query: api.queries.getReviewers, args: { teamSlug: slug } },
					]),
			),
		[crossTeamKey],
	);
	const crossTeamResults = useQueries(crossTeamRequests);
	// A team whose reviewers failed to load gives nobody.
	const crossTeamLists = crossTeamSlugs.map((slug) => {
		const result = crossTeamResults[slug];
		return result instanceof Error ? [] : (result as Reviewer[] | undefined);
	});
	const isLoadingCrossTeam = crossTeamLists.some((list) => list === undefined);
	const teamNameBySlug = new Map(
		availableCrossTeamTargets.map((target) => [target.slug, target.name]),
	);
	const otherTeams = availableCrossTeamTargets.map((target) => ({
		slug: target.slug,
		name: target.name,
	}));
	const otherTeamNameByReviewerId = new Map<string, string>(
		crossTeamSlugs.flatMap((slug, index) => {
			const list = crossTeamLists[index];
			const name = teamNameBySlug.get(slug);
			return list && name
				? list.map((reviewer) => [String(reviewer._id), name] as const)
				: [];
		}),
	);

	const currentUserReviewerId = useMemo(() => {
		if (!user?.email) return undefined;
		return reviewers.find(
			(reviewer) => reviewer.email.toLowerCase() === user.email.toLowerCase(),
		)?._id as Id<"reviewers"> | undefined;
	}, [reviewers, user?.email]);

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

	const resolvedPreview = resolveAssignmentPreview({
		mode,
		slotConfigs: effectiveSlotConfigs,
		reviewers,
		tags,
		selectedTagId,
		currentUserReviewerId,
		reasonMessages: resolverReasonMessages,
		sourceTeamSlug: teamSlug ?? undefined,
		reviewersByTeam: crossTeamActive
			? new Map([
					[teamSlug ?? "", reviewers],
					...crossTeamSlugs.map(
						(slug, index) => [slug, crossTeamLists[index] ?? []] as const,
					),
				])
			: undefined,
		requesterEmail: user?.email,
	});
	const previewReceivers = resolvedPreview.resolved.map(
		(item) => item.reviewer,
	);
	// Another team's reviewer that cannot be named says which team falls short
	// (or that it is still loading), in its row and above the button.
	const slotPreviews = resolvedPreview.slots.map((preview) => {
		const slug = resolvedPreview.payloadSlots[preview.slotIndex]?.teamSlug;
		if (!slug || preview.status === "resolved") return preview;
		return {
			...preview,
			reason: isLoadingCrossTeam
				? t("tags.findingNextReviewer")
				: t("pr.teamsUnavailable", { teams: teamNameBySlug.get(slug) ?? slug }),
		};
	});
	const shortTeamNames = isLoadingCrossTeam
		? []
		: [
				...new Set(
					slotPreviews.flatMap((preview) => {
						const slug =
							resolvedPreview.payloadSlots[preview.slotIndex]?.teamSlug;
						return slug && preview.status === "unresolved"
							? [teamNameBySlug.get(slug) ?? slug]
							: [];
					}),
				),
			];

	// With one reviewer, the rotation menu picks their team (none: this one).
	const setFirstReviewerTeam = (slug: string | undefined) =>
		setSlotConfigs((previous) => {
			const slot = defaultSlotForMode(mode);
			return [
				normalizeSlotForMode(
					{ ...slot, id: previous[0]?.id ?? slot.id, teamSlug: slug },
					mode,
				),
				...previous.slice(1),
			];
		});
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
	// Across teams the preview's picks are the receivers; this team's
	// next-reviewer queries, and who follows in its rotation, do not apply.
	const activeNextReviewer = crossTeamActive
		? (previewReceivers[0] ?? null)
		: mode === "tag"
			? (nextReviewerByTag ?? null)
			: nextReviewer;
	const upcomingReviewer = useMemo(() => {
		if (crossTeamActive || !activeNextReviewer) return null;
		return findUpcomingAfterCurrent(
			availableReviewersForMode,
			activeNextReviewer._id as Id<"reviewers">,
		);
	}, [activeNextReviewer, availableReviewersForMode, crossTeamActive]);
	// The viewer is skipped when they are next, so who follows the receiver
	// leaves them out too.
	const upcomingAfterReceiver = useMemo(() => {
		if (crossTeamActive) return null;
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
		crossTeamActive,
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
		multipleReceivers:
			isMultiAssignmentActive || crossTeamActive ? previewReceivers : null,
		otherTeamNameByReviewerId: crossTeamActive
			? otherTeamNameByReviewerId
			: undefined,
	};
	const lastHeroPicksRef = useRef(heroPicks);
	if (!isLoadingPicks) lastHeroPicksRef.current = heroPicks;
	const heroShown = isLoadingPicks ? lastHeroPicksRef.current : heroPicks;

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
				slots: resolvedPreview.payloadSlots,
				prUrl: prUrl.trim() || undefined,
				contextUrl: contextUrl.trim() || undefined,
				urgent,
				crossTeamReview: crossTeamActive,
				additionalTeamSlugs: crossTeamActive ? crossTeamSlugs : undefined,
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

	// Any reviewer the preview cannot name blocks the button: assigning the rest
	// would quietly send fewer than asked.
	const unresolvedReason = slotPreviews.flatMap((preview) =>
		preview.status === "unresolved" ? [preview.reason] : [],
	)[0];
	const isAssignDisabled =
		isAssigning ||
		!parsedPrUrl ||
		(mode === "tag" && !selectedTagId) ||
		isLoadingCrossTeam ||
		unresolvedReason !== undefined ||
		resolvedPreview.resolved.length === 0;

	// A disabled primary action always says what is missing.
	const assignBlockedReason = (() => {
		if (isAssigning || !isAssignDisabled) return null;
		if (!prUrl.trim()) return t("pr.assignDisabledNeedsUrl");
		// The field already shows the format error in place; repeating it here
		// would say the same thing twice.
		if (hasPrUrlError) return null;
		if (!parsedPrUrl) return t("pr.assignDisabledNeedsUrl");
		if (isLoadingCrossTeam) return null;
		if (shortTeamNames.length > 0)
			return t("pr.teamsUnavailable", {
				teams: new Intl.ListFormat(locale, { type: "conjunction" }).format(
					shortTeamNames,
				),
			});
		if (resolvedPreview.resolved.length === 0)
			return t("pr.assignDisabledNoReviewer");
		return unresolvedReason ?? null;
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
	const namedReceiver = receivers.length === 1 ? receivers[0] : null;
	// The rotation landed on the person who already has this PR; say so and
	// offer the way to pick someone else instead of a silent second notice.
	const duplicateIsReceiver =
		namedReceiver !== null &&
		namedReceiver.reviewer.name === duplicateCheck.duplicate?.reviewerName;
	const isReassigning = duplicateCheck.duplicate !== null;
	// The button counts what was asked; a row that cannot be filled is said under
	// the field. Until other teams' reviewers load, nothing is known.
	const askedCount = resolvedPreview.payloadSlots.length;
	const assignLabel = isLoadingCrossTeam
		? t("pr.assignPR")
		: askedCount > 1
			? t(isReassigning ? "pr.assignAgainToCount" : "pr.assignToCount", {
					count: askedCount,
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
		!team?.hasGoogleChatWebhook || crossTeamActive
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
					multipleReceivers={heroShown.multipleReceivers}
					isLoadingTagReviewer={isLoadingTagReviewer}
					rotationMenu={
						<RotationMenu
							tags={tags}
							selectedTagId={selectedTagId}
							onTagChange={(tagId) => {
								setSelectedTagId(tagId);
								if (!isMultiAssignmentActive) setFirstReviewerTeam(undefined);
							}}
							otherTeams={otherTeams}
							selectedTeamSlug={
								isMultiAssignmentActive ? undefined : slotConfigs[0]?.teamSlug
							}
							onTeamChange={
								isMultiAssignmentActive ? undefined : setFirstReviewerTeam
							}
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
						// The one reviewer left keeps the first row's team.
						setSlotConfigs((previous) => [
							{ ...defaultSlotForMode(mode), teamSlug: previous[0]?.teamSlug },
						]);
					}}
					urgent={urgent}
					onUrgentChange={setUrgent}
					availableCrossTeamTargets={availableCrossTeamTargets}
					reviewers={reviewers}
					slotConfigs={slotConfigs}
					reviewerSlotPreviews={slotPreviews}
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
