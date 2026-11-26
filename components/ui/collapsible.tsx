"use client"

import {
  CollapsiblePanel as CollapsiblePanelPrimitive,
  Collapsible as CollapsiblePrimitive,
  CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from "@ui-sdk/react/collapsible"
import type * as React from "react"
import { type AsChildProps, asChildProps } from "@/lib/as-child"
import { cn } from "@/lib/utils"

function Collapsible(props: React.ComponentProps<typeof CollapsiblePrimitive>) {
  return <CollapsiblePrimitive {...props} />
}

function CollapsibleTrigger({
  asChild,
  children,
  ...props
}: Omit<React.ComponentProps<typeof CollapsibleTriggerPrimitive>, "children"> &
  AsChildProps & { children?: React.ReactNode }) {
  return (
    <CollapsibleTriggerPrimitive {...props} {...asChildProps(asChild, children)} />
  )
}

/**
 * ui-sdk's CollapsiblePanel under Radix's name. Closed, it unmounts after its
 * exit animation, as Radix's did. Its height transitions on ui-sdk's measured
 * --collapsible-panel-height (the curve of tw-animate's collapsible keyframes),
 * so a panel already open when it mounts doesn't animate, as with Radix.
 * Without motion, ui-sdk leaves a closing panel up for a moment before
 * unmounting it; it hides at once instead.
 */
function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePanelPrimitive>) {
  return (
    <CollapsiblePanelPrimitive
      className={cn(
        "h-(--collapsible-panel-height) overflow-hidden ease-[ease-out] data-ending-style:h-0 data-starting-style:h-0 motion-safe:transition-[height] motion-safe:duration-200 motion-reduce:data-closed:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
