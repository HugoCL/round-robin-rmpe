import { useEffect } from "react";
import {
	focusPrUrlInput,
	isOverlayOpen,
	isTypingTarget,
	submitAssignmentOrFocus,
} from "@/lib/assignmentFocus";

interface KeyboardShortcutsProps {
	onSkipReviewer: () => Promise<void>;
	onUndoAssignment: () => Promise<void>;
	isNextReviewerAvailable: boolean;
	/**
	 * Called instead of executing the action immediately. Should open a confirmation UI.
	 * Provide the action key (assign|skip|undo|refresh) and a runner to execute when confirmed.
	 */
	onShortcutTriggered?: (
		action: "skip" | "undo",
		run: () => Promise<void>,
	) => void;
}

/**
 * Single-key shortcuts, active only while focus is outside a field.
 *
 * They deliberately avoid Ctrl/Cmd combinations: the previous bindings shadowed
 * select-all, save and undo, including undo inside the PR URL field itself.
 */
export function useKeyboardShortcuts({
	onSkipReviewer,
	onUndoAssignment,
	isNextReviewerAvailable,
	onShortcutTriggered,
}: KeyboardShortcutsProps) {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			if (isOverlayOpen(event.target)) return;

			const key = event.key.toLowerCase();

			// "/" jumps to the PR URL field from anywhere outside a field: it is the
			// first step of the flow and used to take half a dozen tabs to reach.
			if (key === "/" && !isTypingTarget(event.target)) {
				if (focusPrUrlInput()) event.preventDefault();
				return;
			}

			if (isTypingTarget(event.target)) return;

			switch (key) {
				case "a":
					// Same path as the card's button, so its mode, options and checks apply.
					if (submitAssignmentOrFocus()) event.preventDefault();
					break;
				case "s":
					if (isNextReviewerAvailable) {
						event.preventDefault();
						const run = () => onSkipReviewer();
						if (onShortcutTriggered) return onShortcutTriggered("skip", run);
						void run();
					}
					break;
				case "u": {
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
		onSkipReviewer,
		onUndoAssignment,
		isNextReviewerAvailable,
		onShortcutTriggered,
	]);
}
