"use client"

import * as React from "react"
import * as SelectPrimitive from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

function Select(props: SelectPrimitive.SelectRootProps<string, false>) {
  return <SelectPrimitive.Select.Root {...props} />
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.SelectTriggerProps) {
  return (
    <SelectPrimitive.Select.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:ring-2 focus:ring-ring focus:outline-none data-[popup-open]:border-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="opacity-50" />
    </SelectPrimitive.Select.Trigger>
  )
}

function SelectValue({
  className,
  ...props
}: SelectPrimitive.SelectValueProps) {
  return (
    <SelectPrimitive.Select.Value
      className={cn(
        "text-sm data-[placeholder]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.SelectPopupProps) {
  return (
    <SelectPrimitive.Select.Portal>
      <SelectPrimitive.Select.Positioner className="z-50">
        <SelectPrimitive.Select.Popup
          className={cn(
            "min-w-[var(--anchor-width)] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md focus:outline-none",
            className
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Select.Popup>
      </SelectPrimitive.Select.Positioner>
    </SelectPrimitive.Select.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.SelectItemProps) {
  return (
    <SelectPrimitive.Select.Item
      className={cn(
        "relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected]:font-medium",
        className
      )}
      {...props}
    >
      <SelectPrimitive.Select.ItemIndicator className="absolute left-2 flex size-3.5 items-center justify-center">
        <Check className="size-4" />
      </SelectPrimitive.Select.ItemIndicator>
      <SelectPrimitive.Select.ItemText className="ml-5">
        {children}
      </SelectPrimitive.Select.ItemText>
    </SelectPrimitive.Select.Item>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
