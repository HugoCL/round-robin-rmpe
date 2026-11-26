"use client"

import {
  PopoverContent as PopoverContentPrimitive,
  Popover as PopoverPrimitive,
  PopoverTrigger as PopoverTriggerPrimitive,
} from "@ui-sdk/react/popover"
import * as React from "react"

import { RadixLayerBridge } from "@/components/ui/portal-container"
import { type AsChildProps, asChildProps } from "@/lib/as-child"
import { cn } from "@/lib/utils"

/** The element a `PopoverAnchor` placed, for the content to open against. */
const PopoverAnchorContext = React.createContext<{
  anchor: HTMLElement | null
  setAnchor: (anchor: HTMLElement | null) => void
} | null>(null)

/**
 * Radix's Popover API on ui-sdk's. Both default to non-modal: the page stays
 * usable, and focus or a press leaving the popover closes it.
 */
function Popover(props: React.ComponentProps<typeof PopoverPrimitive>) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const value = React.useMemo(() => ({ anchor, setAnchor }), [anchor])
  return (
    <PopoverAnchorContext.Provider value={value}>
      <PopoverPrimitive {...props} />
    </PopoverAnchorContext.Provider>
  )
}

function PopoverTrigger({
  asChild,
  children,
  ...props
}: Omit<React.ComponentProps<typeof PopoverTriggerPrimitive>, "children"> &
  AsChildProps & { children?: React.ReactNode }) {
  return (
    <PopoverTriggerPrimitive {...props} {...asChildProps(asChild, children)} />
  )
}

function PopoverContent({
  className,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  // Radix's default; ui-sdk keeps a gap from the viewport edge otherwise.
  collisionPadding = 0,
  anchor,
  children,
  ...props
}: Omit<React.ComponentProps<typeof PopoverContentPrimitive>, "children"> & {
  children?: React.ReactNode
}) {
  const anchored = React.useContext(PopoverAnchorContext)?.anchor
  return (
    <PopoverContentPrimitive
      side={side}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      anchor={anchor ?? anchored ?? undefined}
      className={cn(
        "calm-panel z-50 flex w-72 origin-(--transform-origin) flex-col gap-4 bg-background/96 p-4 text-sm text-foreground outline-hidden duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:duration-0",
        className
      )}
      {...props}
    >
      <RadixLayerBridge />
      {children}
    </PopoverContentPrimitive>
  )
}

/** Positions the popover against this element instead of its trigger. */
function PopoverAnchor(props: React.ComponentProps<"div">) {
  const setAnchor = React.useContext(PopoverAnchorContext)?.setAnchor
  return <div data-slot="popover-anchor" ref={setAnchor} {...props} />
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1.5 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("text-base leading-tight font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
