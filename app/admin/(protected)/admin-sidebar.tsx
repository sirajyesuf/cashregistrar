"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  LayoutDashboard,
  Menu,
  Receipt,
  Settings2,
  User,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { cn } from "@/lib/utils"
import { AdminUserMenu } from "./admin-user-menu"

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/invoices", label: "Invoices", icon: Receipt },
  { href: "/admin/system", label: "System", icon: Settings2 },
  { href: "/admin/profile", label: "Profile", icon: User },
]

function NavItems({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <link.icon className="size-4 shrink-0" />
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
        CR
      </span>
      <span className="text-sm font-semibold tracking-tight">
        CashRegistrar
      </span>
    </span>
  )
}

export function AdminSidebar({
  name,
  email,
}: {
  name: string | null
  email: string
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="text-muted-foreground"
        >
          <Menu />
        </Button>
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <AdminUserMenu name={name} email={email} />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavItems pathname={pathname} />
        </div>
        <div className="border-t p-3">
          <AdminUserMenu name={name} email={email} fullWidth />
        </div>
      </aside>

      {/* Desktop theme switcher — fixed to the top-right corner */}
      <div className="fixed top-4 right-4 z-40 hidden md:block">
        <ThemeSwitcher />
      </div>

      {/* Mobile drawer */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          showCloseButton={false}
          className="fixed inset-y-0 left-0 flex w-72 max-w-[calc(100%-2rem)] flex-col rounded-none border-r bg-card p-0 sm:max-w-xs"
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <Brand />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <NavItems
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
          <div className="border-t p-3">
            <AdminUserMenu name={name} email={email} fullWidth />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
