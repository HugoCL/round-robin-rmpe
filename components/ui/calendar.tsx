"use client"

import { ArrowLeftIcon, ArrowRightIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CalendarDay,
  type CalendarDayState,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  Calendar as CalendarPrimitive,
  type CalendarValue,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
} from "@ui-sdk/react/calendar"
import { format } from "date-fns"
import { enUS, es } from "date-fns/locale"
import { useLocale } from "next-intl"
import type * as React from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** A local date as the calendar's ISO value, like `"2026-11-26"`. */
function toCalendarDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

/** A calendar ISO date as a local `Date` at midnight. */
function fromCalendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

const navButtonClass = cn(
  buttonVariants({ variant: "ghost" }),
  "size-(--cell-size) p-0 select-none aria-disabled:opacity-50"
)

// The look of a day, as a ghost icon Button. The cell (`td`) is the focusable
// gridcell, so this span only paints, and the ring follows the cell's focus.
const dayButtonClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon",
    className:
    "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-focus/day:relative group-focus/day:z-10 group-focus/day:border-ring group-focus/day:ring-[3px] group-focus/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
  })
)

const dayCellClass =
  "group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center outline-none select-none [&:last-child[data-selected]>span]:rounded-r-(--cell-radius) [&:first-child[data-selected]>span]:rounded-l-(--cell-radius)"

type DayMarks = {
  selected: boolean
  rangeStart: boolean
  rangeMiddle: boolean
  rangeEnd: boolean
}

/**
 * How a day is marked, as the day picker this replaced marked it: from the
 * value, not from the preview of a range being picked. While a range's end is
 * being picked only its start is selected, drawn as a single day.
 */
function markDay(
  date: string,
  mode: string | undefined,
  value: CalendarValue,
  anchor: string | null
): DayMarks {
  const none = { selected: false, rangeStart: false, rangeMiddle: false, rangeEnd: false }
  if (mode === "range") {
    if (anchor) return { ...none, selected: date === anchor }
    if (!Array.isArray(value) || value.length !== 2) return none
    const [start, end] = value as [string, string]
    return {
      selected: start <= date && date <= end,
      rangeStart: date === start,
      rangeMiddle: start < date && date < end,
      rangeEnd: date === end,
    }
  }
  if (mode === "multiple") {
    return { ...none, selected: Array.isArray(value) && value.includes(date) }
  }
  return { ...none, selected: value === date }
}

// Joined, not merged: the cell keeps every class the day picker gave it.
function dayCellClassName(state: CalendarDayState, marks: DayMarks) {
  return [
    dayCellClass,
    !state.disabled && "cursor-pointer",
    marks.rangeStart &&
      "relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted",
    marks.rangeMiddle && "rounded-none",
    marks.rangeEnd &&
      "relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted",
    state.today &&
      "rounded-(--cell-radius) bg-muted text-foreground data-[selected]:rounded-none",
    state.outside && "text-muted-foreground aria-selected:text-muted-foreground",
    state.disabled && "text-muted-foreground opacity-50",
  ]
    .filter(Boolean)
    .join(" ")
}

type CalendarProps = Omit<React.ComponentProps<typeof CalendarPrimitive>, "children">

/**
 * ui-sdk's Calendar with La Lista's look (the shadcn day picker it replaced):
 * one month, Previous and Next at the top corners, the month name, two-letter
 * weekdays and round days. Values are ISO dates (`toCalendarDate` and
 * `fromCalendarDate` convert local `Date`s). The language follows the app's
 * locale, and the week starts as date-fns says for it (Monday in Spanish).
 */
function Calendar({
  className,
  locale: localeProp,
  weekStartsOn,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const appLocale = useLocale()
  const locale = localeProp ?? appLocale
  const dateLocale = locale.startsWith("es") ? es : enUS

  return (
    <CalendarPrimitive
      locale={locale}
      weekStartsOn={weekStartsOn ?? dateLocale.options?.weekStartsOn ?? 0}
      showOutsideDays={showOutsideDays}
      className={cn(
        "w-fit group/calendar bg-background p-3 [--cell-radius:var(--radius-4xl)] [--cell-size:--spacing(8)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent rtl:**:[[data-slot=calendar-next]>svg]:rotate-180 rtl:**:[[data-slot=calendar-previous]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {(calendar) => (
        <div className="relative flex flex-col gap-4 md:flex-row">
          <div className="absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1">
            <CalendarPrevious className={navButtonClass}>
              <HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} className="size-4" />
            </CalendarPrevious>
            <CalendarNext className={navButtonClass}>
              <HugeiconsIcon icon={ArrowRightIcon} strokeWidth={2} className="size-4" />
            </CalendarNext>
          </div>
          <div className="flex w-full flex-col gap-4">
            <div className="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)">
              <CalendarHeading className="font-medium select-none text-sm">
                {(heading) =>
                  format(fromCalendarDate(`${heading.month}-01`), "LLLL y", {
                    locale: dateLocale,
                  })
                }
              </CalendarHeading>
            </div>
            <CalendarGrid className="w-full border-collapse">
              <CalendarWeekdays className="[&>tr]:flex">
                {(index) => (
                  <CalendarWeekday
                    index={index}
                    className="flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none"
                  >
                    {(weekday) =>
                      // 2026-11-01 is a Sunday, weekday 0.
                      format(new Date(2026, 10, 1 + weekday.weekday), "cccccc", {
                        locale: dateLocale,
                      })
                    }
                  </CalendarWeekday>
                )}
              </CalendarWeekdays>
              <CalendarWeeks className="[&>tr]:mt-2 [&>tr]:flex [&>tr]:w-full">
                {(cell) => {
                  const marks = markDay(cell.date, calendar.mode, calendar.value, calendar.anchor)
                  return (
                    <CalendarDay
                      value={cell.date}
                      className={(day) => dayCellClassName(day, marks)}
                    >
                      {(day) => (
                        <span
                          data-variant="ghost"
                          data-size="icon"
                          data-selected-single={
                            marks.selected &&
                            !marks.rangeStart &&
                            !marks.rangeEnd &&
                            !marks.rangeMiddle
                          }
                          data-range-start={marks.rangeStart}
                          data-range-end={marks.rangeEnd}
                          data-range-middle={marks.rangeMiddle}
                          className={cn(
                            dayButtonClass,
                            day.disabled && "pointer-events-none opacity-50"
                          )}
                        >
                          {day.label}
                        </span>
                      )}
                    </CalendarDay>
                  )
                }}
              </CalendarWeeks>
            </CalendarGrid>
          </div>
        </div>
      )}
    </CalendarPrimitive>
  )
}

export { Calendar, fromCalendarDate, toCalendarDate }
