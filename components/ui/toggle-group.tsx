"use client"

import {
  ToggleGroup as ToggleGroupPrimitive,
  Toggle as TogglePrimitive,
} from "@ui-sdk/react/toggle"
import { type VariantProps } from "class-variance-authority"
import * as React from "react"
import { toggleVariants } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
  orientation: "horizontal",
})

type ToggleGroupValueProps =
  | {
      type: "single"
      value?: string
      defaultValue?: string
      onValueChange?: (value: string) => void
    }
  | {
      type: "multiple"
      value?: string[]
      defaultValue?: string[]
      onValueChange?: (value: string[]) => void
    }

type ToggleGroupProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  "value" | "defaultValue" | "onValueChange" | "multiple" | "orientation" | "children"
> &
  ToggleGroupValueProps &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
    children?: React.ReactNode
  }

const toArray = (value: string | string[] | undefined) =>
  value === undefined ? undefined : Array.isArray(value) ? value : value ? [value] : []

/**
 * ui-sdk's ToggleGroup with Radix's API: `type="single"` takes and reports a
 * string (`""` when the pressed toggle is unpressed), `type="multiple"` an
 * array. Arrow keys move focus and Enter or Space presses, as in Radix.
 * Unlike Radix, toggles in a disabled group stay focusable with
 * `aria-disabled`, and single toggles report `aria-pressed` instead of
 * `role="radio"`.
 */
function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  orientation = "horizontal",
  children,
  type,
  value,
  defaultValue,
  onValueChange,
  ...props
}: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-[spacing=0]:data-[variant=outline]:rounded-4xl data-vertical:flex-col data-vertical:items-stretch",
        className
      )}
      multiple={type === "multiple"}
      orientation={orientation}
      {...(value !== undefined && { value: toArray(value) })}
      {...(defaultValue !== undefined && {
        defaultValue: toArray(defaultValue),
      })}
      onValueChange={
        onValueChange
          ? (next: string[]) => {
              if (type === "multiple") onValueChange(next)
              else onValueChange(next[0] ?? "")
            }
          : undefined
      }
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{ variant, size, spacing, orientation }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-3 group-data-[spacing=0]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-4xl group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-xl group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-4xl group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-xl data-[pressed]:bg-muted group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
