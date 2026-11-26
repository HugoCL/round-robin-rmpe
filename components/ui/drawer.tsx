"use client"

import {
  DrawerBackdrop as DrawerBackdropPrimitive,
  DrawerClose as DrawerClosePrimitive,
  DrawerContent as DrawerContentPrimitive,
  DrawerDescription as DrawerDescriptionPrimitive,
  Drawer as DrawerPrimitive,
  DrawerTitle as DrawerTitlePrimitive,
  DrawerTrigger as DrawerTriggerPrimitive,
} from "@ui-sdk/react/drawer"
import * as React from "react"

import { type RadixFocusProps, useRadixFocus } from "@/components/ui/dialog"
import { type AsChildProps, asChildProps } from "@/lib/as-child"
import { cn } from "@/lib/utils"

type DrawerSide = "top" | "right" | "bottom" | "left"

function Drawer({
  direction,
  side,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive> & {
  /** vaul's name for `side`, kept for call sites. */
  direction?: DrawerSide
}) {
  return <DrawerPrimitive side={side ?? direction ?? "bottom"} {...props} />
}

function DrawerTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DrawerTriggerPrimitive> & AsChildProps) {
  return (
    <DrawerTriggerPrimitive {...props} {...asChildProps(asChild, children)} />
  )
}

/** Kept for call sites from the vaul version: ui-sdk renders in place. */
function DrawerPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DrawerClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DrawerClosePrimitive> & AsChildProps) {
  return (
    <DrawerClosePrimitive {...props} {...asChildProps(asChild, children)} />
  )
}

/** The drawer sets the backdrop's opacity as it moves, so no fade here. */
function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerBackdropPrimitive>) {
  return (
    <DrawerBackdropPrimitive
      className={cn(
        "fixed inset-0 z-50 bg-background/72 backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  initialFocus,
  finalFocus,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof DrawerContentPrimitive>, "children"> &
  RadixFocusProps & {
    children?: React.ReactNode
  }) {
  const contentRef = React.useRef<HTMLElement | null>(null)
  const focus = useRadixFocus({ onOpenAutoFocus, onCloseAutoFocus }, contentRef)
  const setRefs = React.useCallback(
    (el: HTMLElement | null) => {
      contentRef.current = el
      if (typeof ref === "function") ref(el as HTMLDivElement)
      else if (ref) ref.current = el as HTMLDivElement
    },
    [ref]
  )

  // The viewport around the content pins it to its edge and slides it; the
  // classes only size and paint it. The `after` block covers the gap a drag
  // past the edge opens, as vaul's did.
  return (
    <>
      <DrawerOverlay />
      <DrawerContentPrimitive
        ref={setRefs}
        initialFocus={initialFocus ?? focus.initialFocus}
        finalFocus={finalFocus ?? focus.finalFocus}
        className={cn(
          "calm-shell group/drawer-content relative flex h-auto flex-col bg-background/96 p-2 text-sm text-foreground outline-none after:absolute after:bg-inherit after:content-[''] data-[side=bottom]:mt-24 data-[side=bottom]:max-h-[80vh] data-[side=bottom]:w-full data-[side=bottom]:rounded-b-none data-[side=bottom]:after:inset-x-0 data-[side=bottom]:after:top-full data-[side=bottom]:after:h-[200%] data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:rounded-l-none data-[side=left]:after:inset-y-0 data-[side=left]:after:right-full data-[side=left]:after:w-[200%] data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:rounded-r-none data-[side=right]:after:inset-y-0 data-[side=right]:after:left-full data-[side=right]:after:w-[200%] data-[side=top]:mb-24 data-[side=top]:max-h-[80vh] data-[side=top]:w-full data-[side=top]:rounded-t-none data-[side=top]:after:inset-x-0 data-[side=top]:after:bottom-full data-[side=top]:after:h-[200%] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-2 hidden h-1.5 w-16 shrink-0 rounded-full bg-muted-foreground/25 group-data-[side=bottom]/drawer-content:block" />
        {children}
      </DrawerContentPrimitive>
    </>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-2 border-b border-border/60 p-4 group-data-[side=bottom]/drawer-content:text-center group-data-[side=top]/drawer-content:text-center md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 border-t border-border/60 p-4",
        className
      )}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerTitlePrimitive>) {
  return (
    <DrawerTitlePrimitive
      className={cn(
        "text-lg leading-tight font-semibold text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerDescriptionPrimitive>) {
  return (
    <DrawerDescriptionPrimitive
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}
