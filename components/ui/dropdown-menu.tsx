"use client"

import * as MenuPrimitive from "@base-ui/react/menu"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

function DropdownMenu(props: MenuPrimitive.MenuRootProps) {
  return <MenuPrimitive.Menu.Root {...props} />
}

function DropdownMenuTrigger({
  className,
  ...props
}: MenuPrimitive.MenuTriggerProps) {
  return (
    <MenuPrimitive.Menu.Trigger
      className={cn(
        "flex items-center gap-2 rounded-lg transition-colors outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-popup-open:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: MenuPrimitive.MenuPopupProps & { sideOffset?: number }) {
  return (
    <MenuPrimitive.Menu.Portal>
      <MenuPrimitive.Menu.Positioner
        className="z-50"
        sideOffset={sideOffset}
        align="end"
      >
        <MenuPrimitive.Menu.Popup
          className={cn(
            "min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md focus:outline-none",
            className
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Menu.Popup>
      </MenuPrimitive.Menu.Positioner>
    </MenuPrimitive.Menu.Portal>
  )
}

function DropdownMenuGroup(props: MenuPrimitive.MenuGroupProps) {
  return <MenuPrimitive.Menu.Group {...props} />
}

function DropdownMenuGroupLabel({
  className,
  ...props
}: MenuPrimitive.MenuGroupLabelProps) {
  return (
    <MenuPrimitive.Menu.GroupLabel
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  ...props
}: MenuPrimitive.MenuItemProps) {
  return (
    <MenuPrimitive.Menu.Item
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuLinkItem({
  className,
  ...props
}: MenuPrimitive.MenuLinkItemProps) {
  return (
    <MenuPrimitive.Menu.LinkItem
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: MenuPrimitive.MenuCheckboxItemProps & { checked?: boolean }) {
  return (
    <MenuPrimitive.Menu.CheckboxItem
      className={cn(
        "relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.Menu.CheckboxItemIndicator>
          <Check className="size-4" />
        </MenuPrimitive.Menu.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.Menu.CheckboxItem>
  )
}

function DropdownMenuRadioGroup(props: MenuPrimitive.MenuRadioGroupProps) {
  return <MenuPrimitive.Menu.RadioGroup {...props} />
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.MenuRadioItemProps) {
  return (
    <MenuPrimitive.Menu.RadioItem
      className={cn(
        "relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.Menu.RadioItemIndicator>
          <Check className="size-4" />
        </MenuPrimitive.Menu.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.Menu.RadioItem>
  )
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-border", className)} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
}
