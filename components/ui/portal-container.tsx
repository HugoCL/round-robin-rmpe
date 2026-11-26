"use client"

import * as React from "react"

/**
 * ui-sdk popups render in the browser's top layer, above anything a Radix
 * portal puts in `document.body`. While some popups are still Radix, a ui-sdk
 * popup renders a `PortalLayer` and a Radix tooltip or popover opened from
 * inside it portals there instead, so it shows on top.
 * Remove once tooltip and popover are ui-sdk.
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

export { PortalLayer, usePortalContainer }
