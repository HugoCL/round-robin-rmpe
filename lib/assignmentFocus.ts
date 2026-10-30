/** Id of the PR URL field — the first thing you touch in the assign flow. */
export const PR_URL_INPUT_ID = "assignment-pr-url";
/** The form holds only the PR field: Enter in any other card input must not assign. */
export const ASSIGNMENT_FORM_ID = "assignment-form";

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

/**
 * The "A" shortcut runs the card's own assign, with the same checks as its
 * button; when those block it, it goes to the field, which says why.
 */
export function submitAssignmentOrFocus() {
	const form = document.getElementById(ASSIGNMENT_FORM_ID);
	// Assign sits outside the form but belongs to it through `form=`, so it is
	// listed in `form.elements`; when it is disabled the field shows why.
	const submitter =
		form instanceof HTMLFormElement
			? Array.from(form.elements).find(
					(element): element is HTMLButtonElement =>
						element instanceof HTMLButtonElement && element.type === "submit",
				)
			: undefined;
	// With the duplicate warning up, A stops where Enter stops: on the button.
	if (form instanceof HTMLFormElement && form.dataset.duplicate === "true") {
		submitter?.focus();
		return Boolean(submitter);
	}
	if (form instanceof HTMLFormElement && submitter && !submitter.disabled) {
		form.requestSubmit();
		return true;
	}
	return focusPrUrlInput();
}

/** The hero's "assign to someone else" link, which the F shortcut clicks. */
export const FORCE_ASSIGN_TRIGGER_ID = "assignment-force-assign";

/** Opens the force-assign dialog through its link, so the card owns the state. */
export function openForceAssign() {
	const trigger = document.getElementById(FORCE_ASSIGN_TRIGGER_ID);
	if (!(trigger instanceof HTMLButtonElement) || trigger.disabled) return false;
	trigger.click();
	return true;
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

/** The card shows a tag's rotation (it marks the PR form with its mode). */
export function isTagModeActive() {
	if (typeof document === "undefined") return false;
	return document.getElementById(ASSIGNMENT_FORM_ID)?.dataset.mode === "tag";
}
