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
 * exit animation, as Radix's did. tw-animate's collapsible keyframes read
 * Radix's height variable, so it's fed from ui-sdk's.
 */
function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePanelPrimitive>) {
  return (
    <CollapsiblePanelPrimitive
      className={cn(
        "overflow-hidden [--radix-collapsible-content-height:var(--collapsible-panel-height)] motion-safe:data-closed:animate-collapsible-up motion-safe:data-open:animate-collapsible-down",
        className
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
