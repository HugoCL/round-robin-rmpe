"use client"

import { Toggle as TogglePrimitive } from "@ui-sdk/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-4xl text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
      },
      size: {
        default: "h-9 min-w-9 rounded-[min(var(--radius-2xl),12px)] px-2.5",
        sm: "h-8 min-w-8 px-3",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ToggleProps = Omit<
  React.ComponentProps<typeof TogglePrimitive>,
  "onPressedChange"
> &
  VariantProps<typeof toggleVariants> & {
    onPressedChange?: (pressed: boolean) => void
  }

/**
 * ui-sdk's Toggle with La Lista's look. It forwards every prop and the ref,
 * so it can be a tooltip trigger's `render` element. `onPressedChange` gets
 * only the new state, and its return value is ignored. Inside a group a
 * disabled toggle stays focusable with `aria-disabled`, so the disabled look
 * also follows `data-disabled`.
 */
function Toggle({
  className,
  variant = "default",
  size = "default",
  onPressedChange,
  ...props
}: ToggleProps) {
  return (
    <TogglePrimitive
      className={cn(toggleVariants({ variant, size, className }))}
      onPressedChange={
        onPressedChange
          ? (pressed) => {
              onPressedChange(pressed)
            }
          : undefined
      }
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
