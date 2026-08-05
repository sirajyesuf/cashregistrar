"use client"

import { createContext, useContext, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Menu } from "@base-ui/react/menu"
import { Menu as MenuIcon, Receipt } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import { authClient } from "@/lib/auth-client"

type SessionUser = {
  id: string
  email: string
  name: string | null
}

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/settings", label: "Settings" },
]

const UserContext = createContext<{ user: SessionUser | null }>({ user: null })

export function useUser() {
  return useContext(UserContext)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = authClient.useSession()
  const user = session?.user ?? null

  useEffect(() => {
    if (!isPending && !user) {
      router.push("/login")
    }
  }, [isPending, user, router])

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <UserContext.Provider value={{ user }}>
      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-6">
              <Link
                href="/dashboard"
                className="flex shrink-0 items-center gap-2"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Receipt className="size-4" />
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  CashRegistrar
                </span>
              </Link>
              <nav className="hidden items-center gap-1 md:flex">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      isActive(item.href)
                        ? "rounded-md bg-muted px-3 py-1.5 text-sm font-medium"
                        : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <Menu.Root>
                <Menu.Trigger
                  aria-label="Open navigation"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted md:hidden"
                >
                  <MenuIcon className="size-4" />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner
                    className="outline-none"
                    sideOffset={8}
                    align="end"
                  >
                    <Menu.Popup className="relative z-50 w-44 origin-[var(--transform-origin)] rounded-xl border bg-popover p-1 text-popover-foreground shadow-md transition-[scale,opacity] duration-100 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                      {NAV.map((item) => (
                        <Menu.LinkItem
                          key={item.href}
                          className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-highlighted:bg-muted data-disabled:opacity-50"
                          render={<Link href={item.href} />}
                        >
                          {item.label}
                        </Menu.LinkItem>
                      ))}
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
              {user && <UserMenu name={user.name} email={user.email} />}
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </UserContext.Provider>
  )
}
