"use client"

import {
  Radio,
  RadioGroup as RadioGroupPrimitive,
  RadioIndicator,
} from "@ui-sdk/react/radio"
import type * as React from "react"

import { cn } from "@/lib/utils"

type RadioGroupProps = Omit<
  React.ComponentProps<typeof RadioGroupPrimitive>,
  "value" | "defaultValue" | "onValueChange"
> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/**
 * ui-sdk's RadioGroup with Radix's string API: `""` checks nothing, and
 * `onValueChange` gets only the value (`""` when a form reset clears it).
 * Arrow keys wrap, and Enter does nothing, as in Radix.
 */
function RadioGroup({
  className,
  value,
  defaultValue,
  onValueChange,
  loop = true,
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupPrimitive
      className={cn("grid w-full gap-3", className)}
      loop={loop}
      {...(value !== undefined && { value: value || null })}
      {...(defaultValue !== undefined && {
        defaultValue: defaultValue || null,
      })}
      onValueChange={
        onValueChange
          ? (next) => {
              onValueChange(next ?? "")
            }
          : undefined
      }
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof Radio>) {
  return (
    <Radio
      className={cn(
        "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className
      )}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.key === "Enter") event.preventDefault()
      }}
      {...props}
    >
      <RadioIndicator className="flex size-4 items-center justify-center">
        <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
      </RadioIndicator>
    </Radio>
  )
}

export { RadioGroup, RadioGroupItem }
