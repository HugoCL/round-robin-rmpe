import { useEffect } from "react";

interface KeyboardShortcutsProps {
	onAssignPR: () => Promise<void>;
	onSkipReviewer: () => Promise<void>;
	onUndoAssignment: () => Promise<void>;
	isNextReviewerAvailable: boolean;
	/**
	 * Called instead of executing the action immediately. Should open a confirmation UI.
	 * Provide the action key (assign|skip|undo|refresh) and a runner to execute when confirmed.
	 */
	onShortcutTriggered?: (
		action: "assign" | "skip" | "undo",
		run: () => void,
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
						const run = () => {
							void onAssignPR();
						};
						if (onShortcutTriggered) return onShortcutTriggered("assign", run);
						run();
					}
					break;
				case "s":
					if (isNextReviewerAvailable) {
						event.preventDefault();
						const run = () => {
							void onSkipReviewer();
						};
						if (onShortcutTriggered) return onShortcutTriggered("skip", run);
						run();
					}
					break;
				case "z": {
					event.preventDefault();
					const runUndo = () => {
						void onUndoAssignment();
					};
					if (onShortcutTriggered) return onShortcutTriggered("undo", runUndo);
					runUndo();
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
