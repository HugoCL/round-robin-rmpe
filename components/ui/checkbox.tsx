"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckboxIndicator,
  Checkbox as CheckboxPrimitive,
  type CheckedState,
} from "@ui-sdk/react/checkbox"
import type * as React from "react"
import { cn } from "@/lib/utils"

type CheckboxProps = Omit<
  React.ComponentProps<typeof CheckboxPrimitive>,
  "onCheckedChange"
> & {
  onCheckedChange?: (checked: CheckedState) => void
}

/**
 * ui-sdk's Checkbox with La Lista's look. As with Radix, Enter does nothing:
 * ui-sdk would submit the surrounding form. `onCheckedChange` gets only the
 * new state, and its return value is ignored.
 */
function Checkbox({
  className,
  onCheckedChange,
  onKeyDown,
  ...props
}: CheckboxProps) {
  return (
    <CheckboxPrimitive
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[6px] border border-input transition-shadow outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
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
        if (event.key === "Enter") event.preventDefault()
      }}
      {...props}
    >
      <CheckboxIndicator className="grid place-content-center text-current transition-none [&>svg]:size-3.5">
        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
      </CheckboxIndicator>
    </CheckboxPrimitive>
  )
}

export { Checkbox }
