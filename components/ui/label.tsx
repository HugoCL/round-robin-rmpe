"use client"

import { Label as LabelPrimitive } from "@ui-sdk/react/label"
import type * as React from "react"

import { cn } from "@/lib/utils"

/** Shared with `FieldLabel`, which renders ui-sdk's field label part. */
const labelClassName =
  "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"

/**
 * ui-sdk's Label. `htmlFor` works as before; for a control that a native
 * label can't name (a radio group, a slider), it also names it with
 * `aria-labelledby` and moves focus there on a press.
 */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive>) {
  return <LabelPrimitive className={cn(labelClassName, className)} {...props} />
}

export { Label, labelClassName }
