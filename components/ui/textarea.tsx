import { Textarea as TextareaPrimitive } from "@ui-sdk/react/textarea"
import type * as React from "react"

import { cn } from "@/lib/utils"

/** Native fields take numbers too; ui-sdk wants the string. */
type NativeValue = string | number | readonly string[]

type TextareaProps = Omit<
  React.ComponentProps<typeof TextareaPrimitive>,
  "value" | "defaultValue"
> & {
  value?: NativeValue
  defaultValue?: NativeValue
}

/**
 * ui-sdk's Textarea: a native `<textarea>` that joins a ui-sdk Field around
 * it. It keeps CSS `field-sizing` for growing; Enter always adds a line.
 */
function Textarea({
  className,
  value,
  defaultValue,
  ...props
}: TextareaProps) {
  return (
    <TextareaPrimitive
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none rounded-xl border border-input bg-input/30 px-3 py-3 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...(value !== undefined && { value: String(value) })}
      {...(defaultValue !== undefined && { defaultValue: String(defaultValue) })}
      {...props}
    />
  )
}

export { Textarea }
