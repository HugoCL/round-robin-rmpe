"use client"

import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MenuCheckboxItem as MenuCheckboxItemPrimitive,
  MenuContent as MenuContentPrimitive,
  MenuGroupLabel as MenuGroupLabelPrimitive,
  MenuGroup as MenuGroupPrimitive,
  MenuItemIndicator as MenuItemIndicatorPrimitive,
  MenuItem as MenuItemPrimitive,
  Menu as MenuPrimitive,
  MenuRadioGroup as MenuRadioGroupPrimitive,
  MenuRadioItem as MenuRadioItemPrimitive,
  MenuSeparator as MenuSeparatorPrimitive,
  MenuSubContent as MenuSubContentPrimitive,
  MenuSub as MenuSubPrimitive,
  MenuSubTrigger as MenuSubTriggerPrimitive,
  MenuTrigger as MenuTriggerPrimitive,
} from "@ui-sdk/react/menu"
import * as React from "react"
import { RadixLayerBridge } from "@/components/ui/portal-container"
import { type AsChildProps, asChildProps } from "@/lib/as-child"
import { cn } from "@/lib/utils"

/**
 * Radix's DropdownMenu API on ui-sdk's Menu. `modal` keeps Radix's default
 * (`true`: scroll locked, the rest of the page inert).
 */
function DropdownMenu({
  modal = true,
  ...props
}: React.ComponentProps<typeof MenuPrimitive>) {
  return <MenuPrimitive modal={modal} {...props} />
}

/** Kept for call sites from the Radix version: ui-sdk renders in place. */
function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuTriggerPrimitive>, "children"> &
  AsChildProps & { children?: React.ReactNode }) {
  return <MenuTriggerPrimitive {...props} {...asChildProps(asChild, children)} />
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  // Radix's default; ui-sdk keeps a gap from the viewport edge otherwise.
  collisionPadding = 0,
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuContentPrimitive>, "children"> & {
  children?: React.ReactNode
}) {
  return (
    <MenuContentPrimitive
      sideOffset={sideOffset}
      align={align}
      collisionPadding={collisionPadding}
      className={cn(
        "calm-panel z-50 max-h-(--available-height) w-(--anchor-width) min-w-48 origin-(--transform-origin) overflow-x-hidden overflow-y-auto bg-background/96 p-1 text-foreground duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:duration-0",
        className
      )}
      {...props}
    >
      <RadixLayerBridge />
      {children}
    </MenuContentPrimitive>
  )
}

/**
 * The label of the nearest `DropdownMenuGroup`. ui-sdk's group label names the
 * enclosing radio group before a group nested in it, so a group labels itself.
 */
const GroupLabelContext = React.createContext<{
  id: string
  setLabelled: (labelled: boolean) => void
} | null>(null)

function DropdownMenuGroup(props: React.ComponentProps<typeof MenuGroupPrimitive>) {
  const id = React.useId()
  const [labelled, setLabelled] = React.useState(false)
  const label = React.useMemo(() => ({ id, setLabelled }), [id])
  return (
    <GroupLabelContext.Provider value={label}>
      <MenuGroupPrimitive
        aria-labelledby={labelled ? id : undefined}
        {...props}
      />
    </GroupLabelContext.Provider>
  )
}

/**
 * Calls a Radix-style `onSelect` without handing its return value to ui-sdk:
 * a returned Promise would make the item pending and keep the menu open, and
 * a throw would only land in the item's state.
 */
function selectHandler(onSelect: ((event: Event) => void) | undefined) {
  if (!onSelect) return undefined
  return (event: Event) => {
    try {
      onSelect(event)
    } catch (error) {
      reportError(error)
    }
  }
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  asChild,
  children,
  onSelect,
  textValue,
  ...props
}: Omit<React.ComponentProps<typeof MenuItemPrimitive>, "children" | "onSelect"> &
  AsChildProps & {
    children?: React.ReactNode
    inset?: boolean
    variant?: "default" | "destructive"
    onSelect?: (event: Event) => void
    /** Radix's typeahead text; ui-sdk calls it `label`. */
    textValue?: string
  }) {
  return (
    <MenuItemPrimitive
      data-inset={inset}
      data-variant={variant}
      label={textValue}
      onSelect={selectHandler(onSelect)}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-inset:pl-9.5 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
      {...asChildProps(asChild, children)}
    />
  )
}

/**
 * Radix closes the menu when a checkbox or radio item is chosen, unless the
 * item's `onSelect` prevents it; ui-sdk keeps it open. Every call site that
 * passes `onSelect` to these items prevents the default, so an `onSelect`
 * keeps the menu open and its absence closes it.
 */
function closesOnSelect(
  closeOnSelect: boolean | undefined,
  onSelect: ((event: Event) => void) | undefined
) {
  return closeOnSelect ?? !onSelect
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  value,
  onSelect,
  onCheckedChange,
  closeOnSelect,
  ...props
}: Omit<
  React.ComponentProps<typeof MenuCheckboxItemPrimitive>,
  "value" | "children" | "onSelect" | "onCheckedChange"
> & {
  children?: React.ReactNode
  inset?: boolean
  value?: string
  onSelect?: (event: Event) => void
  onCheckedChange?: (checked: boolean) => void
}) {
  const fallbackValue = React.useId()
  return (
    <MenuCheckboxItemPrimitive
      data-inset={inset}
      value={value ?? fallbackValue}
      checked={checked}
      closeOnSelect={closesOnSelect(closeOnSelect, onSelect)}
      onCheckedChange={(next) => {
        selectHandler(onSelect)?.(new Event("select", { cancelable: true }))
        onCheckedChange?.(next)
      }}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-inset:pl-9.5 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuItemIndicatorPrimitive>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
        </MenuItemIndicatorPrimitive>
      </span>
      {children}
    </MenuCheckboxItemPrimitive>
  )
}

function DropdownMenuRadioGroup(
  props: React.ComponentProps<typeof MenuRadioGroupPrimitive>
) {
  return <MenuRadioGroupPrimitive {...props} />
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  onSelect,
  closeOnSelect,
  ...props
}: Omit<
  React.ComponentProps<typeof MenuRadioItemPrimitive>,
  "children" | "onSelect"
> & {
  children?: React.ReactNode
  inset?: boolean
  onSelect?: (event: Event) => void
}) {
  return (
    <MenuRadioItemPrimitive
      data-inset={inset}
      closeOnSelect={closesOnSelect(closeOnSelect, onSelect)}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-inset:pl-9.5 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuItemIndicatorPrimitive>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
        </MenuItemIndicatorPrimitive>
      </span>
      {children}
    </MenuRadioItemPrimitive>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenuGroupLabelPrimitive> & {
  inset?: boolean
}) {
  const group = React.useContext(GroupLabelContext)
  const setLabelled = group?.setLabelled
  React.useLayoutEffect(() => {
    if (!setLabelled) return
    setLabelled(true)
    return () => setLabelled(false)
  }, [setLabelled])
  const labelProps = {
    "data-inset": inset,
    className: cn(
      "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground data-inset:pl-9.5",
      className
    ),
  }
  if (group) {
    const { render: _render, ...divProps } = props
    return (
      <div
        id={group.id}
        data-slot="menu-group-label"
        {...labelProps}
        {...(divProps as React.ComponentProps<"div">)}
      />
    )
  }
  return <MenuGroupLabelPrimitive {...labelProps} {...props} />
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuSeparatorPrimitive>) {
  return (
    <MenuSeparatorPrimitive
      className={cn("-mx-1 my-1 h-px bg-border/50", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-highlighted/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub(props: React.ComponentProps<typeof MenuSubPrimitive>) {
  return <MenuSubPrimitive {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuSubTriggerPrimitive>, "children"> & {
  children?: React.ReactNode
  inset?: boolean
}) {
  return (
    <MenuSubTriggerPrimitive
      data-inset={inset}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-inset:pl-9.5 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-auto" />
    </MenuSubTriggerPrimitive>
  )
}

function DropdownMenuSubContent({
  className,
  collisionPadding = 0,
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuSubContentPrimitive>, "children"> & {
  children?: React.ReactNode
}) {
  return (
    <MenuSubContentPrimitive
      collisionPadding={collisionPadding}
      className={cn(
        "calm-panel z-50 min-w-36 origin-(--transform-origin) overflow-hidden bg-background/96 p-1 text-foreground duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:duration-0",
        className
      )}
      {...props}
    >
      <RadixLayerBridge />
      {children}
    </MenuSubContentPrimitive>
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
