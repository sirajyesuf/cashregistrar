"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTheme } from "@/components/theme-provider"
import { ChevronDown, KeyRound, LogOut, Moon, Shield, Sun, UserRound } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="py-1 pr-1.5 pl-1"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(name)}
        </span>
        <span className="hidden text-sm font-medium md:block">{name}</span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? (
            <Sun className="text-muted-foreground" />
          ) : (
            <Moon className="text-muted-foreground" />
          )}
          {isDark ? "Light Mode" : "Dark Mode"}
        </DropdownMenuItem>
        <DropdownMenuLinkItem render={<Link href="/profile" />}>
          <UserRound className="text-muted-foreground" />
          Profile
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={<Link href="/api-keys" />}>
          <KeyRound className="text-muted-foreground" />
          API Keys
        </DropdownMenuLinkItem>
        {isAdmin && (
          <DropdownMenuLinkItem render={<Link href="/admin" />}>
            <Shield className="text-muted-foreground" />
            Admin
          </DropdownMenuLinkItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-destructive focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
        >
          <LogOut />
          {signingOut ? "Signing out…" : "Sign Out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
