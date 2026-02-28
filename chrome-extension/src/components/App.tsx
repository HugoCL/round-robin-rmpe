import { useUser } from "@clerk/chrome-extension";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@/ui/spinner";
import {
	defaultSlotForMode,
	normalizeSlotForMode,
	useAssignment,
} from "../hooks/useAssignment";
import { useChatToggle } from "../hooks/useChatToggle";
import { useCheckPR } from "../hooks/useCheckPR";
import { usePRDetection } from "../hooks/usePRDetection";
import { useTeamStorage } from "../hooks/useTeamStorage";
import type { AssignmentMode, SlotConfig } from "../types";
import { AlreadyAssignedWarning } from "./AlreadyAssignedWarning";
import { ChatToggle } from "./ChatToggle";
import { ErrorMessage } from "./ErrorMessage";
import { ForceAssignPanel } from "./ForceAssignPanel";
import { Header } from "./Header";
import { MultiAssignPreview } from "./MultiAssignPreview";
import { MultiAssignToggle } from "./MultiAssignToggle";
import { NextReviewerCard } from "./NextReviewerCard";
import { PRBanner } from "./PRBanner";
import { SignInView } from "./SignInView";
import { SlotConfigurator } from "./SlotConfigurator";
import { TagFilter } from "./TagFilter";
import { TeamSelector } from "./TeamSelector";

const convexApi = anyApi as any;

export function App() {
	const { isSignedIn, isLoaded: isClerkLoaded, user } = useUser();

	if (!isClerkLoaded) {
		return (
			<div className="flex items-center justify-center p-8">
				<Spinner />
			</div>
		);
	}

	if (!isSignedIn) {
		return (
			<>
				<Header />
				<SignInView />
			</>
		);
	}

	return (
		<>
			<Header />
			<MainView userEmail={user?.primaryEmailAddress?.emailAddress ?? ""} />
		</>
	);
}

function MainView({ userEmail }: { userEmail: string }) {
	// Auto-detect teams the user belongs to
	const userTeams = useQuery(
		convexApi.queries.getTeamsForUserEmail,
		userEmail ? { email: userEmail } : "skip",
	);
	const userTeamSlugs = useMemo(
		() => (userTeams ?? []).map((t: any) => t.slug),
		[userTeams],
	);

	const {
		selectedTeam,
		saveTeam,
		loaded: teamLoaded,
	} = useTeamStorage(userTeamSlugs);
	const { sendChat, toggleChat } = useChatToggle();
	const { prData, loading: prLoading } = usePRDetection();
	const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
	const [multiAssignEnabled, setMultiAssignEnabled] = useState(false);
	const [reviewerCount, setReviewerCount] = useState(2);
	const [mode, setMode] = useState<AssignmentMode>("regular");
	const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>(() => [
		defaultSlotForMode("regular"),
		defaultSlotForMode("regular"),
	]);

	const {
		teams,
		reviewers,
		availableReviewers,
		tags,
		nextReviewer,
		findReviewerByEmail,
		getNextReviewerByTag,
		resolveSlotPreview,
		assignPR,
		assignPRBatch,
		resetStatus,
		status,
		lastAssignedName,
		lastAssignerName,
		errorMessage,
	} = useAssignment(selectedTeam);

	// Check if this PR was already assigned
	const alreadyAssigned = useCheckPR(selectedTeam, prData?.url ?? null);

	// Get the reviewer to show based on tag filter
	const displayedReviewer = selectedTagId
		? getNextReviewerByTag(selectedTagId)
		: nextReviewer;

	// Find the signed-in user's reviewer record
	const currentUserReviewer = selectedTeam
		? findReviewerByEmail(userEmail)
		: null;

	// Max reviewers for multi-assign
	const maxReviewerCount = Math.max(
		2,
		availableReviewers.filter(
			(r: any) =>
				!currentUserReviewer ||
				String(r._id) !== String(currentUserReviewer._id),
		).length,
	);

	// ── Keep slot configs in sync with reviewer count & mode ──
	useEffect(() => {
		setSlotConfigs((prev) => {
			if (prev.length === reviewerCount) {
				// just normalize for current mode
				return prev.map((s) => normalizeSlotForMode(s, mode));
			}
			if (prev.length < reviewerCount) {
				const extended = [
					...prev.map((s) => normalizeSlotForMode(s, mode)),
					...Array.from({ length: reviewerCount - prev.length }, () =>
						defaultSlotForMode(mode),
					),
				];
				return extended;
			}
			return prev
				.slice(0, reviewerCount)
				.map((s) => normalizeSlotForMode(s, mode));
		});
	}, [reviewerCount, mode]);

	// ── Resolve slot previews ──
	const { previews, payloadSlots } = useMemo(() => {
		if (!multiAssignEnabled) return { previews: [], payloadSlots: [] };
		return resolveSlotPreview(
			slotConfigs,
			mode,
			selectedTagId,
			currentUserReviewer?._id,
		);
	}, [
		multiAssignEnabled,
		slotConfigs,
		mode,
		selectedTagId,
		currentUserReviewer?._id,
		resolveSlotPreview,
	]);

	const handleSlotChange = useCallback(
		(index: number, patch: Partial<SlotConfig>) => {
			setSlotConfigs((prev) =>
				prev.map((s, i) =>
					i === index ? normalizeSlotForMode({ ...s, ...patch }, mode) : s,
				),
			);
		},
		[mode],
	);

	const handleModeChange = useCallback((newMode: AssignmentMode) => {
		setMode(newMode);
		// slots will be normalized by the useEffect above
	}, []);

	const handleAssign = useCallback(
		(reviewerId?: string, forced = false) => {
			const targetReviewer = reviewerId
				? reviewers.find((r: any) => r._id === reviewerId)
				: displayedReviewer;

			if (!targetReviewer || !prData?.url) return;

			assignPR({
				reviewerId: targetReviewer._id,
				prUrl: prData.url,
				forced,
				tagId: selectedTagId ?? undefined,
				actionByReviewerId: currentUserReviewer?._id,
				sendChat,
				reviewerName: targetReviewer.name,
				reviewerEmail: targetReviewer.email,
				reviewerChatId: (targetReviewer as any).googleChatUserId,
				assignerName: currentUserReviewer?.name,
				assignerEmail: currentUserReviewer?.email,
				assignerChatId: (currentUserReviewer as any)?.googleChatUserId,
			});
		},
		[
			displayedReviewer,
			reviewers,
			prData,
			selectedTagId,
			currentUserReviewer,
			sendChat,
			assignPR,
		],
	);

	const handleMultiAssign = useCallback(() => {
		if (!prData?.url) return;

		assignPRBatch({
			mode,
			selectedTagId: selectedTagId ?? undefined,
			payloadSlots,
			prUrl: prData.url,
			actionByReviewerId: currentUserReviewer?._id,
			sendChat,
			assignerName: currentUserReviewer?.name,
			assignerEmail: currentUserReviewer?.email,
			assignerChatId: (currentUserReviewer as any)?.googleChatUserId,
		});
	}, [
		prData,
		mode,
		selectedTagId,
		payloadSlots,
		currentUserReviewer,
		sendChat,
		assignPRBatch,
	]);

	// Count how many slots are resolved
	const resolvedCount = previews.filter((p) => p.status === "resolved").length;

	if (!teamLoaded) {
		return (
			<div className="flex items-center justify-center p-8">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="pb-4">
			<TeamSelector
				teams={teams}
				selectedTeam={selectedTeam}
				onSelect={saveTeam}
				highlightSlugs={userTeamSlugs}
			/>

			{selectedTeam && (
				<>
					<PRBanner prData={prData} loading={prLoading} />

					{alreadyAssigned && (
						<AlreadyAssignedWarning
							reviewerName={alreadyAssigned.reviewerName}
							timestamp={alreadyAssigned.timestamp}
						/>
					)}

					{errorMessage && (
						<ErrorMessage message={errorMessage} onDismiss={resetStatus} />
					)}

					{/* Tag filter — always visible if tags exist (used for single assign & tag mode) */}
					{tags.length > 0 && (
						<TagFilter
							tags={tags}
							selectedTagId={selectedTagId}
							onSelect={setSelectedTagId}
						/>
					)}

					{/* Multi-assign toggle + mode switcher */}
					<MultiAssignToggle
						enabled={multiAssignEnabled}
						onToggle={setMultiAssignEnabled}
						mode={mode}
						onModeChange={handleModeChange}
						hasTags={tags.length > 0}
					/>

					{/* Slot configurator (visible when multi-assign is on) */}
					{multiAssignEnabled && (
						<SlotConfigurator
							mode={mode}
							slots={slotConfigs}
							previews={previews}
							reviewers={reviewers}
							tags={tags}
							selectedTagId={selectedTagId}
							reviewerCount={reviewerCount}
							onReviewerCountChange={setReviewerCount}
							onSlotChange={handleSlotChange}
							maxCount={maxReviewerCount}
						/>
					)}

					{/* Show multi-assign preview/button or single reviewer card */}
					{multiAssignEnabled ? (
						<MultiAssignPreview
							previews={previews}
							resolvedCount={resolvedCount}
							totalSlots={slotConfigs.length}
							status={status}
							lastAssignedName={lastAssignedName}
							lastAssignerName={lastAssignerName}
							prUrl={prData?.url ?? null}
							onAssign={handleMultiAssign}
						/>
					) : (
						<NextReviewerCard
							reviewer={displayedReviewer}
							tags={tags}
							status={status}
							lastAssignedName={lastAssignedName}
							lastAssignerName={lastAssignerName}
							prUrl={prData?.url ?? null}
							onAssign={() => handleAssign()}
						/>
					)}

					{!multiAssignEnabled && (
						<ForceAssignPanel
							reviewers={availableReviewers}
							tags={tags}
							status={status}
							prUrl={prData?.url ?? null}
							onForceAssign={(id) => handleAssign(id, true)}
						/>
					)}

					<ChatToggle sendChat={sendChat} onToggle={toggleChat} />
				</>
			)}

			{!selectedTeam && (
				<div className="flex flex-col items-center justify-center p-6 text-center">
					<svg
						className="w-8 h-8 text-muted-foreground/40 mb-2"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={1.5}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
						/>
					</svg>
					<p className="text-xs text-muted-foreground">
						Selecciona un equipo para comenzar
					</p>
				</div>
			)}
		</div>
	);
}
