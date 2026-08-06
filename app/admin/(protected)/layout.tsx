import { redirect } from "next/navigation"
import { Shield } from "lucide-react"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { getSessionUser } from "@/lib/auth/user"
import { AdminNav } from "./admin-nav"
import { AdminUserMenu } from "./admin-user-menu"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect("/admin/login")
  if (user.role !== "admin") redirect("/dashboard")

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <span className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Admin</span>
          </span>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <AdminUserMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-6">
        <AdminNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
