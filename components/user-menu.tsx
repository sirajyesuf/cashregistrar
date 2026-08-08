"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Menu } from "@base-ui/react/menu"
import { useTheme } from "@/components/theme-provider"
import {
  ChevronDown,
  LogOut,
  Moon,
  Settings,
  Shield,
  Sun,
  UserRound,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"

type Props = {
  name: string | null
  email: string
  isAdmin?: boolean
}

function initials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserMenu({ name, email, isAdmin }: Props) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [signingOut, setSigningOut] = useState(false)
  const isDark = resolvedTheme === "dark"

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      router.push("/login")
    }
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 transition-colors outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(name)}
        </span>
        <span className="hidden text-sm font-medium md:block">{name}</span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="outline-none" sideOffset={8} align="end">
          <Menu.Popup className="relative z-50 w-56 origin-[var(--transform-origin)] rounded-xl border bg-popover p-1 text-popover-foreground shadow-md transition-[scale,opacity] duration-100 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-highlighted:bg-muted data-disabled:opacity-50"
            >
              {isDark ? (
                <Sun className="size-4 text-muted-foreground" />
              ) : (
                <Moon className="size-4 text-muted-foreground" />
              )}
              {isDark ? "Light Mode" : "Dark Mode"}
            </Menu.Item>
            <Menu.LinkItem
              className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-highlighted:bg-muted data-disabled:opacity-50"
              render={<Link href="/profile" />}
            >
              <UserRound className="size-4 text-muted-foreground" />
              Profile
            </Menu.LinkItem>
            <Menu.LinkItem
              className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-highlighted:bg-muted data-disabled:opacity-50"
              render={<Link href="/settings" />}
            >
              <Settings className="size-4 text-muted-foreground" />
              Settings
            </Menu.LinkItem>
            {isAdmin && (
              <Menu.LinkItem
                className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-highlighted:bg-muted data-disabled:opacity-50"
                render={<Link href="/admin" />}
              >
                <Shield className="size-4 text-muted-foreground" />
                Admin
              </Menu.LinkItem>
            )}
            <Menu.Item
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-destructive outline-none select-none data-highlighted:bg-destructive/10 data-disabled:opacity-50"
            >
              <LogOut className="size-4" />
              {signingOut ? "Signing out…" : "Sign Out"}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
