"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Assignment, Reviewer, UserInfo } from "@/lib/types";
import type { ShortcutAction } from "../dialogs/ShortcutConfirmationDialog";

export type ShortcutRunnerOptions = {
	prUrl?: string;
	contextUrl?: string;
	urgent?: boolean;
};

type ShortcutDialogMessageState = {
	shouldSend: boolean;
	customEnabled: boolean;
	prUrl?: string;
	contextUrl?: string;
	urgent?: boolean;
	message?: string;
};

type UseShortcutDialogFlowInput = {
	assignmentFeed: Assignment;
	nextReviewer: Reviewer | null;
	reviewers: Reviewer[];
	teamSlug?: string;
	locale: string;
	userInfo: UserInfo | null;
};

export function useShortcutDialogFlow({
	assignmentFeed,
	nextReviewer,
	reviewers,
	teamSlug,
	locale,
	userInfo,
}: UseShortcutDialogFlowInput) {
	const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);
	const [pendingShortcut, setPendingShortcut] = useState<ShortcutAction | null>(
		null,
	);
	const pendingRunnerRef = useRef<
		((opts?: ShortcutRunnerOptions) => Promise<void>) | null
	>(null);
	const lastMessageState = useRef<ShortcutDialogMessageState | null>(null);
	const sendChatMessage = useAction(api.actions.sendGoogleChatMessage);

	const handleCancelShortcut = useCallback(() => {
		setShortcutDialogOpen(false);
		setPendingShortcut(null);
		pendingRunnerRef.current = null;
		lastMessageState.current = null;
	}, []);

	const handleConfirmShortcut = useCallback(async () => {
		if (pendingRunnerRef.current && pendingShortcut) {
			const shortcutOptions = {
				prUrl: lastMessageState.current?.prUrl,
				contextUrl: lastMessageState.current?.contextUrl,
				urgent: lastMessageState.current?.urgent,
			};
			const preReviewer = nextReviewer;
			await pendingRunnerRef.current(shortcutOptions);
			if (
				lastMessageState.current?.shouldSend &&
				lastMessageState.current.prUrl
			) {
				try {
					let target = preReviewer;
					if (pendingShortcut === "skip" || pendingShortcut === "assign") {
						const newest = assignmentFeed.items[0];
						if (newest) {
							target =
								reviewers.find(
									(r) => String(r._id) === String(newest.reviewerId),
								) || target;
						}
					}
					if (target && teamSlug) {
						await sendChatMessage({
							reviewerName: target.name,
							reviewerEmail: target.email,
							reviewerChatId: target.googleChatUserId,
							prUrl: lastMessageState.current.prUrl,
							contextUrl: lastMessageState.current.contextUrl,
							customMessage: lastMessageState.current.message,
							assignerEmail: userInfo?.email,
							assignerName: userInfo?.firstName || userInfo?.email,
							locale,
							teamSlug,
							urgent: lastMessageState.current.urgent,
						});
					}
				} catch (error) {
					console.warn("Failed to send chat message from shortcut", error);
				}
			}
		}
		handleCancelShortcut();
	}, [
		assignmentFeed.items,
		handleCancelShortcut,
		locale,
		nextReviewer,
		pendingShortcut,
		reviewers,
		sendChatMessage,
		teamSlug,
		userInfo?.email,
		userInfo?.firstName,
	]);

	useEffect(() => {
		const handler = (event: Event) => {
			if (!(event instanceof CustomEvent)) return;
			const detail = event.detail as ShortcutDialogMessageState;
			lastMessageState.current = detail;
		};
		window.addEventListener("shortcutDialogMessageState", handler);
		return () =>
			window.removeEventListener("shortcutDialogMessageState", handler);
	}, []);

	const onShortcutTriggered = useCallback(
		(
			action: ShortcutAction,
			run: (opts?: ShortcutRunnerOptions) => Promise<void>,
		) => {
			setPendingShortcut(action);
			pendingRunnerRef.current = run;
			setShortcutDialogOpen(true);
		},
		[],
	);

	return {
		shortcutDialogOpen,
		setShortcutDialogOpen,
		pendingShortcut,
		handleConfirmShortcut,
		handleCancelShortcut,
		onShortcutTriggered,
	};
}
