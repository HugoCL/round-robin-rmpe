"use client"

import { DismissableLayer } from "@radix-ui/react-dismissable-layer"
import * as React from "react"

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

/** The element a Radix `Portal` should render into, or `undefined` for body. */
function usePortalContainer(): HTMLElement | undefined {
  return React.useContext(PortalContainerContext) ?? undefined
}

/**
 * Radix only lets its topmost layer handle Escape, and it listens on the
 * document before ui-sdk does, so Escape in a ui-sdk menu, select or dialog
 * opened inside a Radix sheet, drawer, alert dialog or popover would close
 * that instead. While a ui-sdk popup is open it renders this empty Radix layer,
 * which becomes the topmost one and does nothing on Escape or outside presses,
 * so the key reaches ui-sdk and closes the popup alone.
 */
function RadixLayerBridge() {
  return <DismissableLayer hidden data-slot="radix-layer-bridge" />
}

export { PortalLayer, RadixLayerBridge, usePortalContainer }
