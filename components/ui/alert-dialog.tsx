"use client"

import {
  AlertDialogBackdrop as AlertDialogBackdropPrimitive,
  AlertDialogClose as AlertDialogClosePrimitive,
  AlertDialogContent as AlertDialogContentPrimitive,
  AlertDialogDescription as AlertDialogDescriptionPrimitive,
  AlertDialog as AlertDialogPrimitive,
  AlertDialogTitle as AlertDialogTitlePrimitive,
  AlertDialogTrigger as AlertDialogTriggerPrimitive,
} from "@ui-sdk/react/alert-dialog"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { type RadixFocusProps, useRadixFocus } from "@/components/ui/dialog"
import { OutsideDrawer, RadixLayerBridge } from "@/components/ui/portal-container"
import { type AsChildProps, asChildProps } from "@/lib/as-child"
import { cn } from "@/lib/utils"

/**
 * Radix's AlertDialog API on ui-sdk's. Always modal; an outside press doesn't
 * close it, Escape does. Opening focuses the first Close part (Cancel), as
 * Radix did.
 */
function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive>) {
  return <AlertDialogPrimitive {...props} />
}

function AlertDialogTrigger({
  asChild,
  children,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialogTriggerPrimitive>, "children"> &
  AsChildProps & { children?: React.ReactNode }) {
  return (
    <AlertDialogTriggerPrimitive {...props} {...asChildProps(asChild, children)} />
  )
}

/** Kept for call sites from the Radix version: ui-sdk renders in place. */
function AlertDialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogBackdropPrimitive>) {
  return (
    <AlertDialogBackdropPrimitive
      className={cn(
        "pointer-events-auto fixed inset-0 z-50 bg-background/72 backdrop-blur-xs duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:duration-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  initialFocus,
  finalFocus,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialogContentPrimitive>, "children"> &
  RadixFocusProps & {
    children?: React.ReactNode
    size?: "default" | "sm"
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
    <OutsideDrawer>
      <AlertDialogOverlay />
      <AlertDialogContentPrimitive
        ref={setRefs}
        initialFocus={initialFocus ?? focus.initialFocus}
        finalFocus={finalFocus ?? focus.finalFocus}
        data-size={size}
        className={cn(
          "calm-shell group/alert-dialog-content pointer-events-auto fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-6 bg-background/96 p-6 text-foreground duration-200 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:duration-0",
          className
        )}
        {...props}
      >
        <RadixLayerBridge modal />
        {children}
      </AlertDialogContentPrimitive>
    </OutsideDrawer>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-14 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-foreground sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-7",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogTitlePrimitive>) {
  return (
    <AlertDialogTitlePrimitive
      className={cn(
        "text-lg leading-tight font-semibold text-foreground sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogDescriptionPrimitive>) {
  return (
    <AlertDialogDescriptionPrimitive
      className={cn(
        "text-sm leading-relaxed text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

type AlertDialogButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "asChild" | "type"
>

/**
 * A Close part that looks like our Button. The click handler goes through the
 * Button, which ignores its return value: ui-sdk's `action` would keep the
 * dialog open and pending while a returned Promise runs.
 */
function AlertDialogButton(props: AlertDialogButtonProps) {
  return <AlertDialogClosePrimitive render={<Button type="button" {...props} />} />
}

function AlertDialogAction({
  variant = "default",
  size = "default",
  ...props
}: AlertDialogButtonProps) {
  return <AlertDialogButton variant={variant} size={size} {...props} />
}

function AlertDialogCancel({
  variant = "outline",
  size = "default",
  ...props
}: AlertDialogButtonProps) {
  return <AlertDialogButton variant={variant} size={size} {...props} />
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
