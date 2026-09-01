import { useEffect } from "react";
import { focusPrUrlInput, isTypingTarget } from "@/lib/assignmentFocus";

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

/**
 * Single-key shortcuts, active only while focus is outside a field.
 *
 * They deliberately avoid Ctrl/Cmd combinations: the previous bindings shadowed
 * select-all, save and undo, including undo inside the PR URL field itself.
 */
export function useKeyboardShortcuts({
	onAssignPR,
	onSkipReviewer,
	onUndoAssignment,
	isNextReviewerAvailable,
	onShortcutTriggered,
}: KeyboardShortcutsProps) {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) return;

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
		onAssignPR,
		onSkipReviewer,
		onUndoAssignment,
		isNextReviewerAvailable,
		onShortcutTriggered,
	]);
}
