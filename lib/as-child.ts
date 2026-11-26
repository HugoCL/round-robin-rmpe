import * as React from "react";

/**
 * Radix's `asChild`, kept on the ui-sdk wrappers so call sites don't change:
 * the single child element becomes the part's `render` element, which gets the
 * part's attributes, handlers and ref (the child's own props win, handlers
 * chain), like Radix's Slot.
 */
type AsChildProps = { asChild?: boolean };

function asChildProps<Children>(
	asChild: boolean | undefined,
	children: Children,
): { render?: React.ReactElement; children?: Children } {
	if (asChild && React.isValidElement(children)) {
		return { render: children };
	}
	return { children };
}

export { type AsChildProps, asChildProps };
