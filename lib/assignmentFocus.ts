/** Id of the PR URL field — the first thing you touch in the assign flow. */
export const PR_URL_INPUT_ID = "assignment-pr-url";

export function focusPrUrlInput() {
	const input = document.getElementById(PR_URL_INPUT_ID);
	if (!(input instanceof HTMLInputElement)) return false;
	input.focus();
	input.select();
	return true;
}

/**
 * True when the key event came from somewhere the user is typing, so a bare
 * letter shortcut must not steal it.
 */
export function isTypingTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
