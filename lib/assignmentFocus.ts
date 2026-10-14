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
	// A focused select picks an option by its first letter.
	if (target.getAttribute("role") === "combobox") return true;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

const OVERLAY_SELECTOR =
	'[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]';

/**
 * A dialog, popover or menu is open (tooltips excluded, they open on hover):
 * single-letter shortcuts must not act on the page behind it.
 */
export function isOverlayOpen(target: EventTarget | null) {
	if (target instanceof Element && target.closest(OVERLAY_SELECTOR))
		return true;
	return Boolean(
		document.querySelector(
			'[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [data-radix-popper-content-wrapper]:not(:has([role="tooltip"]))',
		),
	);
}
