"use client"

import { DismissableLayer } from "@radix-ui/react-dismissable-layer"
import { FocusScope } from "@radix-ui/react-focus-scope"
import * as React from "react"
import { createPortal } from "react-dom"

/**
 * Interop between ui-sdk popups and the popups still on Radix or vaul (sheet,
 * drawer). Remove once those are ui-sdk too.
 */

/**
 * Set inside a vaul drawer's content. vaul starts a drag, and captures the
 * pointer, on any press inside the drawer's DOM, which keeps a press in a field
 * from placing the caret. A ui-sdk dialog opened from a drawer renders in
 * `document.body` instead, as the Radix one did, so its presses are not the
 * drawer's.
 */
const InsideDrawerContext = React.createContext(false)

function InsideDrawer({ children }: { children?: React.ReactNode }) {
  return (
    <InsideDrawerContext.Provider value={true}>
      {children}
    </InsideDrawerContext.Provider>
  )
}

/** Renders `children` in `document.body` when inside a vaul drawer. */
function OutsideDrawer({ children }: { children: React.ReactNode }) {
  const inside = React.useContext(InsideDrawerContext)
  if (!inside || typeof document === "undefined") return <>{children}</>
  return createPortal(
    <InsideDrawerContext.Provider value={false}>
      {children}
    </InsideDrawerContext.Provider>,
    document.body
  )
}

/**
 * Makes an open ui-sdk popup count as the topmost Radix layer, as a Radix popup
 * opened there would. Radix tracks its open sheets, drawers, alert dialogs and
 * popovers in two stacks, and only the top of each acts:
 *
 * - Layers: only the topmost one handles Escape, and it listens on the
 *   document before ui-sdk does. The bridge is an empty layer that does nothing
 *   on Escape or outside presses, so the key reaches ui-sdk and closes the
 *   popup alone. A `modal` bridge also stops the layers below from treating
 *   presses as outside ones, so pressing in a dialog opened over a drawer
 *   leaves the drawer open.
 * - Focus scopes: a trapped scope pulls focus back from anything outside it,
 *   such as a ui-sdk dialog rendered next to the drawer that opened it. The
 *   bridge's scope pauses the one below while the popup is open and leaves the
 *   focus itself to ui-sdk.
 */
function RadixLayerBridge({
  modal = false,
  focusScope = true,
}: {
  modal?: boolean
  /**
   * Whether to pause the Radix focus scope below. A tooltip leaves it off: it
   * never takes focus, and pausing a sheet's trap while a focused control
   * shows its tooltip would let Tab leave the sheet.
   */
  focusScope?: boolean
}) {
  return (
    <>
      <DismissableLayer
        hidden
        disableOutsidePointerEvents={modal}
        data-slot="radix-layer-bridge"
      />
      {focusScope ? (
        <FocusScope
          hidden
          onMountAutoFocus={preventDefault}
          onUnmountAutoFocus={preventDefault}
          data-slot="radix-focus-bridge"
        />
      ) : null}
    </>
  )
}

function preventDefault(event: Event) {
  event.preventDefault()
}

export { InsideDrawer, OutsideDrawer, RadixLayerBridge }
