"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronDown, ExternalLink, LogOut, User } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Props = {
  name: string | null
  email: string
  fullWidth?: boolean
}

function initials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AdminUserMenu({ name, email, fullWidth }: Props) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      router.push("/admin/login")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn("py-1 pr-1.5 pl-1", fullWidth && "w-full")}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(name)}
        </span>
        <span className="hidden flex-1 truncate text-left text-sm font-medium md:block">
          {name}
        </span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </p>
          </DropdownMenuGroupLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem render={<Link href="/dashboard" />}>
          <ExternalLink className="text-muted-foreground" />
          Go to app
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={<Link href="/admin/profile" />}>
          <User className="text-muted-foreground" />
          Profile
        </DropdownMenuLinkItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
