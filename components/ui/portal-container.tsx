"use client"

import { DismissableLayer } from "@radix-ui/react-dismissable-layer"
import { FocusScope } from "@radix-ui/react-focus-scope"
import * as React from "react"
import { createPortal } from "react-dom"

/**
 * Interop between ui-sdk popups and the popups still on Radix (tooltip,
 * popover, alert dialog, sheet, drawer). Remove once every popup is ui-sdk.
 *
 * ui-sdk popups render in the browser's top layer, above anything a Radix
 * portal puts in `document.body`. A ui-sdk dialog renders a `PortalLayer`, and
 * a Radix tooltip or popover opened from inside it portals there instead, so it
 * shows on top.
 */
const PortalContainerContext = React.createContext<HTMLElement | null>(null)

/**
 * A transparent, click-through layer inside a ui-sdk popup's content. It is in
 * the top layer itself, so the content's transform, backdrop filter and
 * overflow neither move nor clip what portals into it; and it is inside the
 * content's DOM, so ui-sdk counts presses and focus in it as inside the popup.
 */
function PortalLayer({ children }: { children?: React.ReactNode }) {
  const [layer, setLayer] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!layer) return
    // Show it after the popup itself, so it stacks above it.
    const frame = requestAnimationFrame(() => {
      if (!layer.isConnected) return
      if (layer.matches(":popover-open")) layer.hidePopover()
      layer.showPopover()
    })
    return () => cancelAnimationFrame(frame)
  }, [layer])

  return (
    <PortalContainerContext.Provider value={layer}>
      {children}
      <div
        ref={setLayer}
        popover="manual"
        data-slot="portal-layer"
        className="pointer-events-none fixed inset-0 m-0 size-full max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 text-inherit *:pointer-events-auto"
      />
    </PortalContainerContext.Provider>
  )
}

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

/** The element a Radix `Portal` should render into, or `undefined` for body. */
function usePortalContainer(): HTMLElement | undefined {
  return React.useContext(PortalContainerContext) ?? undefined
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
function RadixLayerBridge({ modal = false }: { modal?: boolean }) {
  return (
    <>
      <DismissableLayer
        hidden
        disableOutsidePointerEvents={modal}
        data-slot="radix-layer-bridge"
      />
      <FocusScope
        hidden
        onMountAutoFocus={preventDefault}
        onUnmountAutoFocus={preventDefault}
        data-slot="radix-focus-bridge"
      />
    </>
  )
}

function preventDefault(event: Event) {
  event.preventDefault()
}

export {
  InsideDrawer,
  OutsideDrawer,
  PortalLayer,
  RadixLayerBridge,
  usePortalContainer,
}
