"use client"

import {
  Switch as SwitchPrimitive,
  SwitchThumb,
} from "@ui-sdk/react/switch"
import type * as React from "react"

import { cn } from "@/lib/utils"

type SwitchProps = Omit<
  React.ComponentProps<typeof SwitchPrimitive>,
  "onCheckedChange"
> & {
  size?: "sm" | "default"
  onCheckedChange?: (checked: boolean) => void
}

/**
 * ui-sdk's Switch with La Lista's look. As with Radix, Enter toggles it:
 * ui-sdk would submit the surrounding form instead. `onCheckedChange` gets
 * only the new state, and its return value is ignored.
 */
function Switch({
  className,
  size = "default",
  onCheckedChange,
  onKeyDown,
  ...props
}: SwitchProps) {
  return (
    <SwitchPrimitive
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-[background-color,border-color,box-shadow] outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-control-border data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      onCheckedChange={
        onCheckedChange
          ? (checked) => {
              onCheckedChange(checked)
            }
          : undefined
      }
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.key === "Enter" && !event.defaultPrevented) {
          event.preventDefault()
          event.currentTarget.click()
        }
      }}
      {...props}
    >
      <SwitchThumb className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground" />
    </SwitchPrimitive>
  )
}

export { Switch }
