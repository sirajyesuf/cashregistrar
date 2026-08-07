"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import {
  LayoutDashboard,
  Menu,
  Receipt,
  Settings2,
  User,
  Users,
  X,
} from "lucide-react"
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
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
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
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-card shadow-xl outline-none">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
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
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
