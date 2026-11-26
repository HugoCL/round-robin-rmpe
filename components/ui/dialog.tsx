"use client"

import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DialogBackdrop as DialogBackdropPrimitive,
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  Dialog as DialogPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
} from "@ui-sdk/react/dialog"
import { useTranslations } from "next-intl"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { PortalLayer, RadixLayerBridge } from "@/components/ui/portal-container"
import { WithTooltip } from "@/components/ui/tooltip"
import { type AsChildProps, asChildProps } from "@/lib/as-child"
import { cn } from "@/lib/utils"

type DialogProps = React.ComponentProps<typeof DialogPrimitive>

function Dialog(props: DialogProps) {
  return <DialogPrimitive {...props} />
}

function DialogTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogTriggerPrimitive> & AsChildProps) {
  return (
    <DialogTriggerPrimitive {...props} {...asChildProps(asChild, children)} />
  )
}

/** Kept for call sites from the Radix version: ui-sdk renders in place. */
function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DialogClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogClosePrimitive> & AsChildProps) {
  return <DialogClosePrimitive {...props} {...asChildProps(asChild, children)} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogBackdropPrimitive>) {
  return (
    <DialogBackdropPrimitive
      className={cn(
        "fixed inset-0 isolate z-50 bg-background/72 backdrop-blur-xs duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:duration-0",
        className
      )}
      {...props}
    />
  )
}

function DialogCloseButton() {
  const t = useTranslations("common")

  return (
    <WithTooltip label={t("close")} className="absolute top-4 right-4">
      <DialogClose asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("close")}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </DialogClose>
    </WithTooltip>
  )
}

/** The Radix focus hooks, mapped onto ui-sdk's `initialFocus`/`finalFocus`. */
type RadixFocusProps = {
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * Runs a Radix-style focus handler against a cancelable event whose
 * `currentTarget` is the content, and reports whether it took over focus.
 */
function runFocusHandler(
  handler: (event: Event) => void,
  content: HTMLElement | null
): boolean {
  const event = new Event("focus", { cancelable: true })
  Object.defineProperty(event, "currentTarget", { value: content })
  handler(event)
  return event.defaultPrevented
}

function useRadixFocus(
  { onOpenAutoFocus, onCloseAutoFocus }: RadixFocusProps,
  content: React.RefObject<HTMLElement | null>
) {
  const initialFocus =
    onOpenAutoFocus === focusDialogItself
      ? ("content" as const)
      : onOpenAutoFocus
        ? () => {
            // A handler that prevents the default focuses something itself.
            const prevented = runFocusHandler(onOpenAutoFocus, content.current)
            return prevented ? null : content.current
          }
        : undefined
  const finalFocus = onCloseAutoFocus
    ? () => {
        // Radix handlers prevent the default and focus their own target; hand
        // that element back so ui-sdk keeps it. Anything else falls back to the
        // trigger.
        const el = content.current
        runFocusHandler(onCloseAutoFocus, el)
        const active = el?.ownerDocument.activeElement
        return active instanceof HTMLElement && !el?.contains(active)
          ? active
          : null
      }
    : undefined
  return { initialFocus, finalFocus }
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  initialFocus,
  finalFocus,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof DialogContentPrimitive>, "children"> &
  RadixFocusProps & {
    children?: React.ReactNode
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
      <DialogOverlay />
      <DialogContentPrimitive
        ref={setRefs}
        initialFocus={initialFocus ?? focus.initialFocus}
        finalFocus={finalFocus ?? focus.finalFocus}
        className={cn(
          "calm-shell fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 bg-background/96 p-6 text-sm text-foreground duration-200 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:duration-0",
          className
        )}
        {...props}
      >
        <RadixLayerBridge />
        <PortalLayer>
          {children}
          {showCloseButton ? <DialogCloseButton /> : null}
        </PortalLayer>
      </DialogContentPrimitive>
    </>
  )
}

/**
 * `onOpenAutoFocus` for dialogs whose first focusable control has a tooltip
 * (often the close button): focusing it opens the tooltip, which then takes the
 * first Escape. Focusing the dialog itself keeps Escape and Tab working.
 * ui-sdk's DialogContent maps it to `initialFocus="content"`; Radix-based
 * contents (the drawer) still call it as an event handler.
 */
function focusDialogItself(event: Event) {
  event.preventDefault()
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 pr-8", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitlePrimitive>) {
  return (
    <DialogTitlePrimitive
      className={cn(
        "text-lg leading-tight font-semibold text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescriptionPrimitive>) {
  return (
    <DialogDescriptionPrimitive
      className={cn(
        "text-sm leading-relaxed text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  focusDialogItself,
}
