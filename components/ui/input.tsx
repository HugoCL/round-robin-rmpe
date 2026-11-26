import { Input as InputPrimitive } from "@ui-sdk/react/input"
import type * as React from "react"

import { cn } from "@/lib/utils"

/** Native fields take numbers too; ui-sdk wants the string. */
type NativeValue = string | number | readonly string[]

type InputProps = Omit<
  React.ComponentProps<typeof InputPrimitive>,
  "value" | "defaultValue"
> & {
  value?: NativeValue
  defaultValue?: NativeValue
}

/**
 * ui-sdk's Input: a native `<input>` that joins a ui-sdk Field around it.
 * Native props (`value` + `onChange`, `ref`, `aria-*`) work as before and
 * win over the field's. A number `value` is passed on as its string, as the
 * native input would.
 */
function Input({
  className,
  type,
  value,
  defaultValue,
  ...props
}: InputProps) {
  return (
    <InputPrimitive
      type={type}
      className={cn(
        "h-9 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...(value !== undefined && { value: String(value) })}
      {...(defaultValue !== undefined && { defaultValue: String(defaultValue) })}
      {...props}
    />
  )
}

export { Input }
