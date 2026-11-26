"use client"

import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DialogBackdrop as SheetBackdropPrimitive,
  DialogClose as SheetClosePrimitive,
  DialogContent as SheetContentPrimitive,
  DialogDescription as SheetDescriptionPrimitive,
  Dialog as SheetPrimitive,
  DialogTitle as SheetTitlePrimitive,
  DialogTrigger as SheetTriggerPrimitive,
} from "@ui-sdk/react/dialog"
import { useTranslations } from "next-intl"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { type RadixFocusProps, useRadixFocus } from "@/components/ui/dialog"
import { WithTooltip } from "@/components/ui/tooltip"
import { type AsChildProps, asChildProps } from "@/lib/as-child"
import { cn } from "@/lib/utils"

/**
 * A side panel: a ui-sdk dialog pinned to an edge, sliding in with CSS like the
 * dialog's zoom. A dialog rather than ui-sdk's Drawer, whose spring and drag
 * would change how the panel moves.
 */
function Sheet(props: React.ComponentProps<typeof SheetPrimitive>) {
  return <SheetPrimitive {...props} />
}

function SheetTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof SheetTriggerPrimitive> & AsChildProps) {
  return (
    <SheetTriggerPrimitive {...props} {...asChildProps(asChild, children)} />
  )
}

function SheetClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof SheetClosePrimitive> & AsChildProps) {
  return <SheetClosePrimitive {...props} {...asChildProps(asChild, children)} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetBackdropPrimitive>) {
  return (
    <SheetBackdropPrimitive
      className={cn(
        "fixed inset-0 z-50 bg-background/72 backdrop-blur-xs duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:duration-0",
        className
      )}
      {...props}
    />
  )
}

function SheetCloseButton() {
  const t = useTranslations("common")

  return (
    <WithTooltip label={t("close")} className="absolute top-4 right-4">
      <SheetClose asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("close")}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </SheetClose>
    </WithTooltip>
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  initialFocus,
  finalFocus,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof SheetContentPrimitive>, "children"> &
  RadixFocusProps & {
    children?: React.ReactNode
    side?: "top" | "right" | "bottom" | "left"
    showCloseButton?: boolean
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

  return (
    <>
      <SheetOverlay />
      <SheetContentPrimitive
        ref={setRefs}
        initialFocus={initialFocus ?? focus.initialFocus}
        finalFocus={finalFocus ?? focus.finalFocus}
        data-side={side}
        className={cn(
          "calm-shell fixed inset-auto z-50 m-0 flex flex-col border-0 data-[side=right]:border-l data-[side=left]:border-r data-[side=top]:border-b data-[side=bottom]:border-t bg-background/96 bg-clip-padding text-sm text-foreground transition duration-200 ease-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:rounded-b-none data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:rounded-l-none data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:rounded-r-none data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:rounded-t-none data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10 motion-reduce:duration-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? <SheetCloseButton /> : null}
      </SheetContentPrimitive>
    </>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex flex-col gap-2 border-b border-border/60 p-6 pr-14",
        className
      )}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 border-t border-border/60 p-6",
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetTitlePrimitive>) {
  return (
    <SheetTitlePrimitive
      className={cn(
        "text-lg leading-tight font-semibold text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetDescriptionPrimitive>) {
  return (
    <SheetDescriptionPrimitive
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
