"use client"

import {
  TooltipArrow as TooltipArrowPrimitive,
  TooltipContent as TooltipContentPrimitive,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from "@ui-sdk/react/tooltip"
import * as React from "react"
import { createPortal } from "react-dom"

import { RadixLayerBridge } from "@/components/ui/portal-container"
import { type AsChildProps, asChildProps } from "@/lib/as-child"
import { cn } from "@/lib/utils"

/** The delay set by the nearest `TooltipProvider`. */
const TooltipDelayContext = React.createContext<number | undefined>(undefined)

/**
 * Radix's provider API, kept so call sites don't change. ui-sdk groups
 * tooltips without a provider; this one only sets how long the pointer rests
 * on a trigger before the tooltips inside it open (Radix's `delayDuration`).
 */
function TooltipProvider({
  delayDuration = 0,
  children,
}: {
  delayDuration?: number
  /** Radix's; ui-sdk decides on its own when the next tooltip opens at once. */
  skipDelayDuration?: number
  children?: React.ReactNode
}) {
  return (
    <TooltipDelayContext.Provider value={delayDuration}>
      {children}
    </TooltipDelayContext.Provider>
  )
}

function Tooltip({
  delayDuration,
  delay,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive> & {
  /** Radix's name for `delay`. */
  delayDuration?: number
}) {
  const inherited = React.useContext(TooltipDelayContext)
  return <TooltipPrimitive delay={delay ?? delayDuration ?? inherited} {...props} />
}

function TooltipTrigger({
  asChild,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TooltipTriggerPrimitive>, "children"> &
  AsChildProps & { children?: React.ReactNode }) {
  return (
    <TooltipTriggerPrimitive {...props} {...asChildProps(asChild, children)} />
  )
}

/**
 * Lets Escape close the tooltip alone inside a Radix sheet or drawer. It
 * renders in `document.body`: a tooltip closes as Tab leaves its trigger, while
 * focus is briefly on the body, and a node removed then from inside a sheet
 * makes Radix's focus trap pull focus back to the sheet itself.
 */
function TooltipLayerBridge() {
  return createPortal(<RadixLayerBridge focusScope={false} />, document.body)
}

/** The arrow's box: a 10px square, as Radix measured its arrow. */
const ARROW_LENGTH = 10

function TooltipContent({
  className,
  sideOffset = 0,
  // Radix's default; ui-sdk keeps a gap from the viewport edge otherwise.
  collisionPadding = 0,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TooltipContentPrimitive>, "children"> & {
  children?: React.ReactNode
}) {
  return (
    <TooltipContentPrimitive
      // Rendered in place, so phrasing content: a trigger can sit in a <p>.
      render={<span />}
      // Radix counted the arrow's length into the gap; ui-sdk doesn't.
      sideOffset={sideOffset + ARROW_LENGTH}
      collisionPadding={collisionPadding}
      className={cn(
        // A tooltip that opens at once, after another one, skips the entrance
        // (Radix's instant-open).
        "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-2xl bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-4xl not-data-instant:data-open:animate-in not-data-instant:data-open:fade-in-0 not-data-instant:data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className
      )}
      {...props}
    >
      {(state) => (
        <>
          {state.open ? <TooltipLayerBridge /> : null}
          {children}
          {/* A square turned 45°, its center 2px inside the edge facing the trigger. */}
          <TooltipArrowPrimitive
            render={<span />}
            className="z-50 size-2.5 rotate-45 rounded-[2px] bg-foreground data-[side=bottom]:-top-[3px] data-[side=left]:-right-[3px] data-[side=right]:-left-[3px] data-[side=top]:-bottom-[3px]"
          />
        </>
      )}
    </TooltipContentPrimitive>
  )
}

/**
 * Wrap any control that has no visible label. The tooltip's trigger is a span
 * around the control: it takes the hover of a disabled button (which ignores
 * the pointer), works around any child without forwarding its props, and
 * carries `className` for placement.
 */
function WithTooltip({
  label,
  children,
  side = "bottom",
  className,
}: {
  label: string
  children: React.ReactNode
  side?: React.ComponentProps<typeof TooltipContent>["side"]
  className?: string
}) {
  return (
    // The span host has no name of its own; the tooltip names it (the control
    // inside keeps its own aria-label).
    <Tooltip type="label">
      <TooltipTriggerPrimitive
        render={<span className={cn("inline-flex", className)} />}
      >
        {children}
      </TooltipTriggerPrimitive>
      <TooltipContent side={side} sideOffset={6}>
        <span>{label}</span>
      </TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, WithTooltip }
