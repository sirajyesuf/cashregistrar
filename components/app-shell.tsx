"use client"

import { createContext, useContext, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Menu } from "@base-ui/react/menu"
import { LogOut, Menu as MenuIcon, UserRoundCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QueryProvider } from "@/components/query-provider"
import { UserMenu } from "@/components/user-menu"
import { WorkspaceProvider } from "@/components/workspace-provider"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import { authClient } from "@/lib/auth-client"

type SessionUser = {
  id: string
  email: string
  name: string | null
}

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/products", label: "Products" },
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

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/admin/login"

  useEffect(() => {
    if (!isPending && !user && !isAuthPage) {
      router.push("/login")
    }
  }, [isPending, user, router, isAuthPage])

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  const impersonatedBy = session?.session?.impersonatedBy

  const stopImpersonating = async () => {
    await authClient.admin.stopImpersonating()
    router.push("/admin/users")
  }

  return (
    <UserContext.Provider value={{ user }}>
      <QueryProvider>
        <WorkspaceProvider>
          <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3 sm:gap-6">
              <Link
                href="/dashboard"
                className="flex shrink-0 items-center gap-2"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  CR
                </span>
                <span className="hidden text-sm font-semibold tracking-tight sm:block">
                  CashRegistrar
                </span>
              </Link>
              {user && <WorkspaceSwitcher />}
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
              {user && (
                <UserMenu
                  name={user.name}
                  email={user.email}
                  isAdmin={user.role === "ADMIN"}
                />
              )}
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        {impersonatedBy && (
          <footer className="sticky bottom-0 z-40 border-t bg-muted/40 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                  <UserRoundCog className="size-4.5 text-primary" />
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    Viewing as
                  </p>
                  <p className="truncate text-sm font-bold text-foreground">
                    {user?.name || user?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="hidden text-xs text-muted-foreground lg:block">
                  Actions you take will be recorded as this user.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={stopImpersonating}
                >
                  <LogOut className="size-3.5" />
                  Exit impersonation
                </Button>
              </div>
            </div>
          </footer>
        )}
        </div>
        </WorkspaceProvider>
      </QueryProvider>
    </UserContext.Provider>
  )
}
