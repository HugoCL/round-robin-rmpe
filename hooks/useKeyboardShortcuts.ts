import { useEffect } from "react";

interface KeyboardShortcutsProps {
	onAssignPR: (opts?: {
		prUrl?: string;
		contextUrl?: string;
		urgent?: boolean;
	}) => Promise<void>;
	onSkipReviewer: (opts?: {
		prUrl?: string;
		contextUrl?: string;
		urgent?: boolean;
	}) => Promise<void>;
	onUndoAssignment: () => Promise<void>;
	isNextReviewerAvailable: boolean;
	/**
	 * Called instead of executing the action immediately. Should open a confirmation UI.
	 * Provide the action key (assign|skip|undo|refresh) and a runner to execute when confirmed.
	 */
	onShortcutTriggered?: (
		action: "assign" | "skip" | "undo",
		run: (opts?: {
			prUrl?: string;
			contextUrl?: string;
			urgent?: boolean;
		}) => Promise<void>,
	) => void;
}

export function useKeyboardShortcuts({
	onAssignPR,
	onSkipReviewer,
	onUndoAssignment,
	isNextReviewerAvailable,
	onShortcutTriggered,
}: KeyboardShortcutsProps) {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
			const isCtrlOrCmd = event.ctrlKey || event.metaKey;

			if (!isCtrlOrCmd) return;

			// Prevent default browser behavior for our shortcuts
			switch (event.key.toLowerCase()) {
				case "a":
					if (isNextReviewerAvailable) {
						event.preventDefault();
						const run = (opts?: {
							prUrl?: string;
							contextUrl?: string;
							urgent?: boolean;
						}) => {
							return onAssignPR(opts);
						};
						if (onShortcutTriggered) return onShortcutTriggered("assign", run);
						void run();
					}
					break;
				case "s":
					if (isNextReviewerAvailable) {
						event.preventDefault();
						const run = (opts?: {
							prUrl?: string;
							contextUrl?: string;
							urgent?: boolean;
						}) => {
							return onSkipReviewer(opts);
						};
						if (onShortcutTriggered) return onShortcutTriggered("skip", run);
						void run();
					}
					break;
				case "z": {
					event.preventDefault();
					const runUndo = () => {
						return onUndoAssignment();
					};
					if (onShortcutTriggered) return onShortcutTriggered("undo", runUndo);
					void runUndo();
					break;
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [
		onAssignPR,
		onSkipReviewer,
		onUndoAssignment,
		isNextReviewerAvailable,
		onShortcutTriggered,
	]);
}
