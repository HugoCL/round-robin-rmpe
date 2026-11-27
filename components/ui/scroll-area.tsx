"use client"

import {
  ScrollAreaContent as ScrollAreaContentPrimitive,
  ScrollAreaCorner as ScrollAreaCornerPrimitive,
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaScrollbar as ScrollAreaScrollbarPrimitive,
  ScrollAreaThumb as ScrollAreaThumbPrimitive,
  ScrollAreaViewport as ScrollAreaViewportPrimitive,
} from "@ui-sdk/react/scroll-area"
import type * as React from "react"

import { cn } from "@/lib/utils"

/**
 * ui-sdk's ScrollArea with Radix's default: the scrollbar shows while the
 * pointer is over the area or it scrolls (`type="hover"`).
 */
function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive>) {
  return (
    <ScrollAreaPrimitive className={cn("relative", className)} {...props}>
      <ScrollAreaViewportPrimitive className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1">
        <ScrollAreaContentPrimitive>{children}</ScrollAreaContentPrimitive>
      </ScrollAreaViewportPrimitive>
      <ScrollBar />
      <ScrollAreaCornerPrimitive />
    </ScrollAreaPrimitive>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaScrollbarPrimitive>) {
  return (
    <ScrollAreaScrollbarPrimitive
      orientation={orientation}
      className={cn(
        // Radix unmounted a hidden scrollbar; ui-sdk marks a shown one.
        "flex touch-none p-px opacity-0 transition-colors select-none data-visible:opacity-100 data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaThumbPrimitive className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaScrollbarPrimitive>
  )
}

export { ScrollArea, ScrollBar }
