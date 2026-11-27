"use client"

import {
  TabsList as TabsListPrimitive,
  TabsPanel,
  Tabs as TabsPrimitive,
  TabsTab,
} from "@ui-sdk/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@/lib/utils"

type TabsProps = Omit<
  React.ComponentProps<typeof TabsPrimitive>,
  "value" | "defaultValue" | "onValueChange"
> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  activationMode?: "automatic" | "manual"
}

/**
 * ui-sdk's Tabs with Radix's API: string values, `activationMode`, and
 * `forceMount` on the content. Arrow keys wrap and select, as in Radix.
 * ui-sdk marks the selected tab and panel with a bare `data-selected`, and a
 * disabled tab stays focusable with `aria-disabled` (styled by
 * `data-disabled`).
 */
function Tabs({
  className,
  orientation = "horizontal",
  activationMode = "automatic",
  loop = true,
  onValueChange,
  ...props
}: TabsProps) {
  return (
    <TabsPrimitive
      orientation={orientation}
      activation={activationMode}
      loop={loop}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      onValueChange={
        onValueChange
          ? (next) => {
              if (next !== null) onValueChange(next)
            }
          : undefined
      }
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-4xl p-[3px] text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:rounded-2xl data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsListPrimitive> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsListPrimitive
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTab>) {
  return (
    <TabsTab
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-[color,background-color,border-color,box-shadow] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:px-2.5 group-data-vertical/tabs:py-1.5 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[selected]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[selected]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[selected]:bg-transparent",
        "data-[selected]:bg-background data-[selected]:text-foreground dark:data-[selected]:border-input dark:data-[selected]:bg-input/30 dark:data-[selected]:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[selected]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

/**
 * The panel is a Tab stop, as in Radix (ui-sdk makes it one only when it holds
 * nothing focusable).
 */
function TabsContent({
  className,
  forceMount,
  keepMounted,
  tabIndex = 0,
  ...props
}: React.ComponentProps<typeof TabsPanel> & { forceMount?: boolean }) {
  return (
    <TabsPanel
      className={cn("flex-1 text-sm outline-none", className)}
      keepMounted={keepMounted ?? forceMount}
      tabIndex={tabIndex}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants }
