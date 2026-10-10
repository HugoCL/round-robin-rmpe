"use client";

import { useCallback, useRef, useState } from "react";
import type { ShortcutAction } from "../dialogs/ShortcutConfirmationDialog";

/**
 * Holds a keyboard shortcut (skip, undo) until its dialog confirms it. Skip
 * only passes the next person's turn: it carries no PR and sends no Chat
 * message, because it assigns the PR to nobody.
 */
export function useShortcutDialogFlow() {
	const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);
	const [pendingShortcut, setPendingShortcut] = useState<ShortcutAction | null>(
		null,
	);
	const pendingRunnerRef = useRef<(() => Promise<void>) | null>(null);

	const handleCancelShortcut = useCallback(() => {
		setShortcutDialogOpen(false);
		setPendingShortcut(null);
		pendingRunnerRef.current = null;
	}, []);

	const handleConfirmShortcut = useCallback(async () => {
		if (pendingRunnerRef.current && pendingShortcut) {
			await pendingRunnerRef.current();
		}
		handleCancelShortcut();
	}, [handleCancelShortcut, pendingShortcut]);

	const onShortcutTriggered = useCallback(
		(action: ShortcutAction, run: () => Promise<void>) => {
			// One confirmation at a time: S then U must not swap the open dialog.
			if (shortcutDialogOpen) return;
			setPendingShortcut(action);
			pendingRunnerRef.current = run;
			setShortcutDialogOpen(true);
		},
		[shortcutDialogOpen],
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
