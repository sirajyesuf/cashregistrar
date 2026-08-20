"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"

export function DateRangePicker({
  value,
  onValueChange,
}: {
  value: DateRange | undefined
  onValueChange: (range: DateRange | undefined) => void
}) {
  const isMobile = useIsMobile()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="justify-start gap-2 px-2.5 font-normal"
          >
            <CalendarIcon data-icon="inline-start" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, isMobile ? "MMM d" : "LLL dd, y")} –{" "}
                  {format(value.to, isMobile ? "MMM d, y" : "LLL dd, y")}
                </>
              ) : (
                format(value.from, isMobile ? "MMM d" : "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={value?.from}
          selected={value}
          onSelect={onValueChange}
          numberOfMonths={isMobile ? 1 : 2}
        />
      </PopoverContent>
    </Popover>
  )
}
