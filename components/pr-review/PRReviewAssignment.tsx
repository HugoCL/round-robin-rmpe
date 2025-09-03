"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";

// Extend Window typing to allow vendor-prefixed AudioContext in older browsers
declare global {
	interface Window {
		webkitAudioContext?: typeof AudioContext;
	}
}

import { Button } from "@/components/ui/button";
import type { Doc } from "@/convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";
import { useConvexPRReviewData } from "@/hooks/useConvexPRReviewData";
import { useConvexTags } from "@/hooks/useConvexTags";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Assignment, UserInfo } from "@/lib/types";
import {
	type ShortcutAction,
	ShortcutConfirmationDialog,
} from "./dialogs/ShortcutConfirmationDialog";
import { SkipConfirmationDialog } from "./dialogs/SkipConfirmationDialog";
import { SnapshotDialog } from "./dialogs/SnapshotDialog";
import { PageHeader } from "./header/PageHeader";
import { ClassicLayout } from "./layouts/ClassicLayout";
import { CompactLayout } from "./layouts/CompactLayout";
import { PRReviewProvider } from "./PRReviewContext";

// Define the structure for a backup entry
interface BackupEntry {
	key: string;
	description: string;
	timestamp: number;
	formattedDate?: string;
}

/**
 * PRReviewAssignment is the main component for the PR review assignment tool.
 * It acts as a container, fetching data, managing state, and composing the UI
 * from smaller components like layouts, dialogs, and headers.
 *
 * @param {object} props - The component props.
 * @param {string} [props.teamSlug] - The slug of the team currently being viewed.
 */
export default function PRReviewAssignment({
	teamSlug,
}: {
	teamSlug?: string;
}) {
	const t = useTranslations();
	const { user, isLoaded } = useUser();
	const { signOut } = useClerk();
	const importInputId = useId();

	// State for managing UI preferences and dialogs
	const [snapshots, setSnapshots] = useState<BackupEntry[]>([]);
	const [snapshotsLoading, setSnapshotsLoading] = useState(false);
	const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
	const [showAssignments, setShowAssignments] = useState(false);
	const [showTags, setShowTags] = useState(true);
	const [showEmails, setShowEmails] = useState(false);
	const [skipConfirmDialogOpen, setSkipConfirmDialogOpen] = useState(false);
	const [nextAfterSkip, setNextAfterSkip] = useState<Doc<"reviewers"> | null>(
		null,
	);
	const [compactLayout, setCompactLayout] = useState(false);
	const [reviewersDrawerOpen, setReviewersDrawerOpen] = useState(false);
	const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);
	const [pendingShortcut, setPendingShortcut] = useState<ShortcutAction | null>(
		null,
	);
	const pendingRunnerRef = useRef<(() => void) | null>(null);
	// Capture message customization state emitted from dialog
	const lastMessageState = useRef<null | {
		shouldSend: boolean;
		customEnabled: boolean;
		prUrl?: string;
		message?: string;
	}>(null);
	const sendChatMessage = useAction(api.actions.sendGoogleChatMessage);
	// Track the last processed assignment to avoid duplicate notifications
	const lastProcessedAssignmentRef = useRef<string | null>(null);
	// Reusable AudioContext for short beeps
	const audioCtxRef = useRef<AudioContext | null>(null);

	// Custom hooks for data fetching and business logic
	const { hasTags, refreshTags } = useConvexTags(teamSlug);
	const userInfo: UserInfo | null = user
		? {
				email: user.emailAddresses[0]?.emailAddress || "",
				firstName: user.firstName || undefined,
				lastName: user.lastName || undefined,
			}
		: null;

	const {
		reviewers,
		nextReviewer,
		isLoading,
		isRefreshing,
		assignmentFeed: convexAssignmentFeed,
		backups,
		assignPR,
		skipReviewer,
		handleImTheNextOne,
		confirmSkipToNext,
		undoAssignment,
		addReviewer,
		updateReviewer,
		removeReviewer,
		handleToggleAbsence,
		handleResetCounts,
		exportData,
		importData,
		restoreFromBackup,
		handleManualRefresh,
		formatLastUpdated,
	} = useConvexPRReviewData(userInfo, teamSlug);

	// Enable keyboard shortcuts for common actions
	useKeyboardShortcuts({
		onAssignPR: assignPR,
		onSkipReviewer: skipReviewer,
		onUndoAssignment: undoAssignment,
		isNextReviewerAvailable: !!nextReviewer,
		onShortcutTriggered: (action, run) => {
			setPendingShortcut(action);
			pendingRunnerRef.current = run;
			setShortcutDialogOpen(true);
		},
	});

	const handleConfirmShortcut = async () => {
		if (pendingRunnerRef.current && pendingShortcut) {
			// Capture the reviewer before action (for assign)
			const preReviewer = nextReviewer;
			await pendingRunnerRef.current();
			// After running, decide whether to send a message
			if (
				lastMessageState.current?.shouldSend &&
				lastMessageState.current.prUrl
			) {
				try {
					let target = preReviewer;
					// For skip action, target might change; attempt to derive from assignment feed latest
					if (pendingShortcut === "skip" || pendingShortcut === "assign") {
						const newest = assignmentFeed.items[0];
						if (newest) {
							target =
								reviewers.find(
									(r) => String(r._id) === String(newest.reviewerId),
								) || target;
						}
					}
					if (target) {
						const reviewerWithChat = target as unknown as {
							googleChatUserId?: string;
							name: string;
							email: string;
						};
						await sendChatMessage({
							reviewerName: target.name,
							reviewerEmail: target.email,
							reviewerChatId: reviewerWithChat.googleChatUserId,
							prUrl: lastMessageState.current.prUrl,
							customMessage: lastMessageState.current.message,
							assignerEmail: userInfo?.email,
							assignerName: userInfo?.firstName || userInfo?.email,
							teamSlug,
						});
					}
				} catch (e) {
					console.warn("Failed to send chat message from shortcut", e);
				}
			}
		}
		setShortcutDialogOpen(false);
		setPendingShortcut(null);
		pendingRunnerRef.current = null;
	};

	const handleCancelShortcut = () => {
		setShortcutDialogOpen(false);
		setPendingShortcut(null);
		pendingRunnerRef.current = null;
	};

	// Listen for customization events from dialog
	useEffect(() => {
		const handler = (e: Event) => {
			if (!(e instanceof CustomEvent)) return;
			const detail = e.detail as typeof lastMessageState.current;
			lastMessageState.current = detail;
		};
		window.addEventListener("shortcutDialogMessageState", handler);
		return () =>
			window.removeEventListener("shortcutDialogMessageState", handler);
	}, []);

	// Load user preferences from localStorage on component mount
	useEffect(() => {
		const savedShowAssignments = localStorage.getItem("showAssignments");
		if (savedShowAssignments !== null) {
			setShowAssignments(savedShowAssignments === "true");
		}

		const savedShowTags = localStorage.getItem("showTags");
		if (savedShowTags !== null) {
			setShowTags(savedShowTags === "true");
		}

		const savedCompactLayout = localStorage.getItem("compactLayout");
		if (savedCompactLayout !== null) {
			setCompactLayout(savedCompactLayout === "true");
		}

		const savedShowEmails = localStorage.getItem("showEmails");
		if (savedShowEmails !== null) {
			setShowEmails(savedShowEmails === "true");
		}
	}, []);

	// Save user preferences to localStorage whenever they change
	useEffect(() => {
		localStorage.setItem("showAssignments", showAssignments.toString());
	}, [showAssignments]);

	useEffect(() => {
		localStorage.setItem("showTags", showTags.toString());
	}, [showTags]);

	useEffect(() => {
		localStorage.setItem("compactLayout", compactLayout.toString());
	}, [compactLayout]);

	useEffect(() => {
		localStorage.setItem("showEmails", showEmails.toString());
	}, [showEmails]);

	// Transform assignment feed data for child components
	const assignmentFeed: Assignment = {
		items:
			convexAssignmentFeed?.items?.map((item) => ({
				id: `${item.reviewerId}-${item.timestamp}`,
				reviewerId: item.reviewerId,
				reviewerName: item.reviewerName,
				timestamp: item.timestamp,
				isForced: item.forced,
				wasSkipped: item.skipped,
				isAbsentSkip: item.isAbsentSkip,
				actionBy: item.actionBy?.email, // flatten to string per AssignmentItem type
				prUrl: item.prUrl,
				tagId: item.tagId,
			})) || [],
		lastAssigned: convexAssignmentFeed?.lastAssigned
			? // convexAssignmentFeed.lastAssigned appears to be a string reviewerId; timestamp not provided in original code so set null semantics
				{
					reviewerId:
						typeof convexAssignmentFeed.lastAssigned === "string"
							? convexAssignmentFeed.lastAssigned
							: "",
					timestamp: Date.now(),
				}
			: null,
	};

	const handleDataUpdate = async () => {
		await refreshTags();
	};

	// Opens the skip confirmation dialog
	const handleImTheNextOneWithDialog = async () => {
		const result = await handleImTheNextOne();
		if (result.success && result.nextReviewer) {
			setNextAfterSkip(result.nextReviewer);
			setSkipConfirmDialogOpen(true);
		}
	};

	// Confirms the skip action
	const handleConfirmSkipToNext = async () => {
		if (!nextReviewer || !nextAfterSkip) return;
		await confirmSkipToNext(nextReviewer, nextAfterSkip);
		setSkipConfirmDialogOpen(false);
		setNextAfterSkip(null);
	};

	// Cancels the skip action
	const handleCancelSkip = () => {
		setSkipConfirmDialogOpen(false);
		setNextAfterSkip(null);
	};

	// Handles file import for data recovery
	const importFileHandler = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;
		await importData(file);
		event.target.value = ""; // Reset input
	};

	// Loads snapshots from backups
	const loadSnapshots = async () => {
		setSnapshotsLoading(true);
		try {
			const formattedSnapshots: BackupEntry[] = backups.map((backup) => ({
				...backup,
				formattedDate: new Date(backup.timestamp).toLocaleString(),
			}));
			setSnapshots(formattedSnapshots);
		} catch (error) {
			console.error("Error loading snapshots:", error);
			toast({
				title: t("common.error"),
				description: t("messages.loadSnapshotsFailed"),
				variant: "destructive",
			});
		} finally {
			setSnapshotsLoading(false);
		}
	};

	// Opens the snapshot dialog
	const handleOpenSnapshotDialog = () => {
		loadSnapshots();
		setSnapshotDialogOpen(true);
	};

	// Restores data from a selected snapshot
	const handleRestoreSnapshot = async (key: string) => {
		try {
			const success = await restoreFromBackup(key);
			if (success) {
				setSnapshotDialogOpen(false);
			}
		} catch (error) {
			console.error("Error restoring snapshot:", error);
			toast({
				title: t("common.error"),
				description: t("messages.restoreSnapshotFailed"),
				variant: "destructive",
			});
		}
	};

	// Toggles for various UI preferences
	const toggleShowAssignments = () => setShowAssignments((p) => !p);
	const toggleShowTags = () => setShowTags((p) => !p);
	const toggleCompactLayout = () => setCompactLayout((p) => !p);
	const toggleShowEmails = () => setShowEmails((p) => !p);

	// Ensure AudioContext can start after a user gesture (required by some browsers)
	useEffect(() => {
		const ensureAudioContext = async () => {
			try {
				if (!audioCtxRef.current) {
					// Prefer standardized AudioContext if available
					const Ctx: typeof AudioContext | undefined =
						window.AudioContext || window.webkitAudioContext;
					if (!Ctx) return; // No audio context available
					audioCtxRef.current = new Ctx();
				}
				if (audioCtxRef.current.state === "suspended") {
					await audioCtxRef.current.resume();
				}
			} catch {
				// ignore; some environments block autoplay until interaction
			}
		};

		const onFirstInteraction = () => {
			ensureAudioContext();
			window.removeEventListener("pointerdown", onFirstInteraction);
			window.removeEventListener("keydown", onFirstInteraction);
		};

		window.addEventListener("pointerdown", onFirstInteraction, { once: true });
		window.addEventListener("keydown", onFirstInteraction, { once: true });

		return () => {
			window.removeEventListener("pointerdown", onFirstInteraction);
			window.removeEventListener("keydown", onFirstInteraction);
		};
	}, []);

	// Play a short beep
	const playMelody = useCallback(async () => {
		try {
			// Lazily init context if needed
			if (!audioCtxRef.current) {
				const Ctx: typeof AudioContext | undefined =
					window.AudioContext || window.webkitAudioContext;
				if (!Ctx) return;
				audioCtxRef.current = new Ctx();
			}
			const ctx = audioCtxRef.current;
			if (ctx.state === "suspended") {
				await ctx.resume();
			}

			// Simple pleasant up-chime melody (frequencies in Hz)
			// Notes: A5 (880), C#6 (~1108.73), E6 (~1318.51)
			const sequence: Array<{ f: number; d: number }> = [
				{ f: 880, d: 0.18 },
				{ f: 1108.73, d: 0.18 },
				{ f: 1318.51, d: 0.24 },
			];

			const startAt = ctx.currentTime;
			let when = startAt;

			const scheduleTone = (
				frequency: number,
				start: number,
				duration: number,
			) => {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = "sine";
				osc.frequency.value = frequency;
				// Gentle envelope to avoid clicks
				const baseVol = 0.05; // soft volume
				gain.gain.setValueAtTime(0, start);
				gain.gain.linearRampToValueAtTime(baseVol, start + 0.01);
				gain.gain.linearRampToValueAtTime(
					baseVol * 0.8,
					start + duration * 0.6,
				);
				gain.gain.linearRampToValueAtTime(0.0001, start + duration);
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start(start);
				osc.stop(start + duration + 0.005);
				osc.onended = () => {
					try {
						osc.disconnect();
						gain.disconnect();
					} catch {
						/* noop */
					}
				};
			};

			const gap = 0.03; // small gap between notes
			for (const note of sequence) {
				scheduleTone(note.f, when, note.d);
				when += note.d + gap;
			}
		} catch {
			// Fallback: subtle toast if audio is blocked
			toast({
				title: t("pr.reviewAssignedToYou"),
				description: t("pr.youAreNextReviewer"),
			});
		}
	}, [t]);

	// When a new assignment is appended, if it targets the signed-in user, play a sound
	useEffect(() => {
		if (!convexAssignmentFeed?.items || convexAssignmentFeed.items.length === 0)
			return;
		if (!userInfo?.email) return;

		// Feed is stored newest-first in Convex (most recent at index 0).
		const newest = convexAssignmentFeed.items[0];
		const key = `${newest.reviewerId}-${newest.timestamp}`;

		// On first render, initialize with the newest item and skip playing
		if (lastProcessedAssignmentRef.current === null) {
			lastProcessedAssignmentRef.current = key;
			return;
		}

		// Only react to truly new items (a different newest key)
		if (lastProcessedAssignmentRef.current === key) return;
		lastProcessedAssignmentRef.current = key;

		// Skip non-assignment events
		if (newest.skipped || newest.isAbsentSkip) return;

		// Find the assigned reviewer's email
		const assignedReviewer = (reviewers || []).find(
			(r) => String(r._id) === String(newest.reviewerId),
		);
		const assignedEmail = assignedReviewer?.email?.toLowerCase();
		const currentEmail = userInfo.email.toLowerCase();

		if (assignedEmail && assignedEmail === currentEmail) {
			// Optional toast for visibility; mainly play a soft beep
			void playMelody();
		}
		// Only depend on the list to detect new items; reviewers and email are needed for match
	}, [convexAssignmentFeed?.items, reviewers, userInfo?.email, playMelody]);

	// Render loading state
	if (isLoading || !isLoaded) {
		return (
			<div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
				<div className="text-center">
					<h2 className="text-xl font-semibold mb-2">{t("common.loading")}</h2>
					<p className="text-muted-foreground">{t("pr.loadingPleaseWait")}</p>
				</div>
			</div>
		);
	}

	// Render not authenticated state
	if (!user) {
		return (
			<div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
				<div className="text-center">
					<h2 className="text-xl font-semibold mb-2">
						{t("you-are-not-authenticated")}
					</h2>
					<p className="text-muted-foreground">{t("pr.pleaseSignIn")}</p>
				</div>
			</div>
		);
	}

	// Render not authorized state for non-company emails
	if (userInfo && !/^.+@buk\.[a-zA-Z0-9-]+$/.test(userInfo.email)) {
		return (
			<div className="container mx-auto py-6 flex justify-center items-center h-[50vh]">
				<div className="text-center">
					<h2 className="text-xl font-semibold mb-2">
						{t("pr.notAuthorizedTitle")}
					</h2>
					<p className="text-muted-foreground">
						{t("pr.notAuthorizedDescription")} {t("pr.unauthorized")}{" "}
						{userInfo?.email}
					</p>
					<form
						action={async () => {
							await signOut();
						}}
					>
						<Button type="submit">{t("pr.signOut")}</Button>
					</form>
				</div>
			</div>
		);
	}

	return (
		<PRReviewProvider
			value={{
				teamSlug,
				compactLayout,
				toggleCompactLayout,
				showAssignments,
				toggleShowAssignments,
				showTags,
				toggleShowTags,
				showEmails,
				toggleShowEmails,
				openSnapshotDialog: handleOpenSnapshotDialog,
				reviewers: reviewers || [],
				nextReviewer: nextReviewer || null,
				assignmentFeed,
				hasTags: !!hasTags,
				userInfo,
				isRefreshing: !!isRefreshing,
				formatLastUpdated,
				handleManualRefresh: async () => {
					await handleManualRefresh();
				},
				onDataUpdate: async () => {
					await handleDataUpdate();
				},
				assignPR: async (opts) => {
					await assignPR(opts);
				},
				undoAssignment: async () => {
					await undoAssignment();
				},
				handleImTheNextOneWithDialog: async () => {
					await handleImTheNextOneWithDialog();
				},
				onToggleAbsence: async (id) => {
					await handleToggleAbsence(id);
				},
				updateReviewer: async (id, name, email, googleChatUserId) =>
					await updateReviewer(id, name, email, googleChatUserId),
				addReviewer: async (name, email, googleChatUserId) =>
					await addReviewer(name, email, googleChatUserId),
				removeReviewer: async (id) => {
					await removeReviewer(id);
				},
				handleResetCounts,
				exportData,
			}}
		>
			<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 ">
				<PageHeader
					teamSlug={teamSlug}
					reviewersDrawerOpen={reviewersDrawerOpen}
					setReviewersDrawerOpen={setReviewersDrawerOpen}
				/>

				{compactLayout ? <CompactLayout /> : <ClassicLayout />}

				<input
					id={importInputId}
					type="file"
					accept=".json"
					onChange={importFileHandler}
					className="hidden"
				/>

				<SnapshotDialog
					isOpen={snapshotDialogOpen}
					onOpenChange={setSnapshotDialogOpen}
					snapshots={snapshots}
					isLoading={snapshotsLoading}
					onRestore={handleRestoreSnapshot}
				/>

				<SkipConfirmationDialog
					isOpen={skipConfirmDialogOpen}
					onOpenChange={setSkipConfirmDialogOpen}
					nextAfterSkip={nextAfterSkip}
					onConfirm={handleConfirmSkipToNext}
					onCancel={handleCancelSkip}
				/>

				<ShortcutConfirmationDialog
					isOpen={shortcutDialogOpen}
					action={pendingShortcut}
					nextReviewerName={nextReviewer?.name}
					currentReviewerName={nextReviewer?.name}
					nextAfterSkipName={nextAfterSkip?.name}
					lastAssignmentFrom={assignmentFeed.items[0]?.actionBy || null}
					lastAssignmentTo={assignmentFeed.items[0]?.reviewerName || null}
					onConfirm={() => handleConfirmShortcut()}
					onCancel={handleCancelShortcut}
					onOpenChange={(open) => {
						if (!open) handleCancelShortcut();
						else setShortcutDialogOpen(true);
					}}
				/>
			</div>
		</PRReviewProvider>
	);
}
