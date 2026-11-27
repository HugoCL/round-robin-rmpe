"use client"

import { Tick02Icon, UnfoldMoreIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SelectContent as SelectContentPrimitive,
  SelectGroupLabel as SelectGroupLabelPrimitive,
  SelectGroup as SelectGroupPrimitive,
  SelectItemIndicator as SelectItemIndicatorPrimitive,
  SelectItem as SelectItemPrimitive,
  Select as SelectPrimitive,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
} from "@ui-sdk/react/select"
import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * What each item renders, by value, so the trigger can show the selected
 * item's own content (a color swatch, an icon) as Radix's SelectValue did,
 * not only its text.
 */
function createItemRegistry() {
  const items = new Map<string, React.ReactNode>()
  const listeners = new Set<() => void>()
  let version = 0
  return {
    set(value: string, node: React.ReactNode) {
      if (items.get(value) === node) return
      items.set(value, node)
      version += 1
      for (const listener of listeners) listener()
    },
    delete(value: string) {
      if (!items.delete(value)) return
      version += 1
      for (const listener of listeners) listener()
    },
    get: (value: string) => items.get(value),
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    version: () => version,
  }
}

type ItemRegistry = ReturnType<typeof createItemRegistry>

const ItemRegistryContext = React.createContext<ItemRegistry | null>(null)

type SelectProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  required?: boolean
  name?: string
  form?: string
  autoComplete?: string
  children?: React.ReactNode
}

/**
 * A single-value select with Radix's string API: `""` or `undefined` on a
 * controlled select means nothing is selected, and `onValueChange` only ever
 * receives a string.
 */
function Select(allProps: SelectProps) {
  const { value, defaultValue, onValueChange, children, ...props } = allProps
  const [registry] = React.useState(createItemRegistry)
  // Radix treats a `value` prop that is `undefined` as "nothing selected yet".
  const controlled = "value" in allProps
  return (
    <ItemRegistryContext.Provider value={registry}>
      {/* The trigger, the hidden form input and the in-place list are
          siblings. Grouping them keeps a parent's `space-y-*` margin off the
          trigger, as when the list lived in a portal. */}
      <div data-slot="select" className="contents">
        <SelectPrimitive<string>
          {...(controlled ? { value: value || null } : {})}
          defaultValue={defaultValue || undefined}
          onValueChange={(next) => {
            if (typeof next === "string") onValueChange?.(next)
          }}
          {...props}
        >
          {children}
        </SelectPrimitive>
      </div>
    </ItemRegistryContext.Provider>
  )
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof SelectGroupPrimitive>) {
  return (
    <SelectGroupPrimitive className={cn("scroll-my-1 p-1", className)} {...props} />
  )
}

function SelectValue({
  children,
  placeholder,
  ...props
}: Omit<React.ComponentProps<typeof SelectValuePrimitive>, "children"> & {
  children?: React.ReactNode
}) {
  const registry = React.useContext(ItemRegistryContext)
  React.useSyncExternalStore(
    registry?.subscribe ?? noopSubscribe,
    registry?.version ?? zero,
    zero
  )
  return (
    <SelectValuePrimitive placeholder={placeholder} {...props}>
      {children !== undefined
        ? children
        : (state) =>
            state.placeholder
              ? placeholder
              : (registry?.get(String(state.value)) ?? state.label)}
    </SelectValuePrimitive>
  )
}

const noopSubscribe = () => () => {}
const zero = () => 0

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: Omit<React.ComponentProps<typeof SelectTriggerPrimitive>, "children"> & {
  children?: React.ReactNode
  size?: "sm" | "default"
}) {
  return (
    <SelectTriggerPrimitive
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <HugeiconsIcon
        icon={UnfoldMoreIcon}
        strokeWidth={2}
        aria-hidden="true"
        className="pointer-events-none size-4 text-muted-foreground"
      />
    </SelectTriggerPrimitive>
  )
}

/**
 * The list. Radix's default `position="item-aligned"` maps to ui-sdk's
 * `alignItemWithTrigger`. It stays mounted while closed, as Radix's items did,
 * so the trigger knows each item's label before the list first opens.
 */
function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  keepMounted = true,
  // Radix's default; ui-sdk keeps a gap from the viewport edge otherwise.
  collisionPadding = 0,
  ...props
}: Omit<React.ComponentProps<typeof SelectContentPrimitive>, "children"> & {
  children?: React.ReactNode
  position?: "item-aligned" | "popper"
}) {
  const alignItemWithTrigger = position === "item-aligned"
  return (
    <SelectContentPrimitive
      data-align-trigger={alignItemWithTrigger}
      alignItemWithTrigger={alignItemWithTrigger}
      align={align}
      keepMounted={keepMounted}
      collisionPadding={collisionPadding}
      sideOffset={position === "popper" ? 4 : undefined}
      className={cn(
        "relative z-50 max-h-(--available-height) min-w-[max(9rem,var(--anchor-width))] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-2xl bg-popover p-0 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className
      )}
      {...props}
    >
      {children}
    </SelectContentPrimitive>
  )
}

/** A group's heading (Radix's SelectLabel). */
function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectGroupLabelPrimitive>) {
  return (
    <SelectGroupLabelPrimitive
      className={cn("px-3 py-2.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  value,
  ...props
}: Omit<React.ComponentProps<typeof SelectItemPrimitive<string>>, "children"> & {
  children?: React.ReactNode
}) {
  const registry = React.useContext(ItemRegistryContext)
  React.useLayoutEffect(() => {
    registry?.set(value, children)
  }, [registry, value, children])
  React.useLayoutEffect(
    () => () => registry?.delete(value),
    [registry, value]
  )

  return (
    <SelectItemPrimitive<string>
      value={value}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <SelectItemIndicatorPrimitive>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="pointer-events-none" />
        </SelectItemIndicatorPrimitive>
      </span>
      <span>{children}</span>
    </SelectItemPrimitive>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectSeparatorPrimitive>) {
  return (
    <SelectSeparatorPrimitive
      className={cn(
        "pointer-events-none -mx-1 my-1 h-px bg-border/50",
        className
      )}
      {...props}
    />
  )
}

/** Radix scroll buttons; ui-sdk's list scrolls natively, so these render nothing. */
function SelectScrollUpButton(_props: React.ComponentProps<"div">) {
  return null
}

function SelectScrollDownButton(_props: React.ComponentProps<"div">) {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
