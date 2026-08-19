import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/user"
import { QueryProvider } from "@/components/query-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AdminSidebar } from "./admin-sidebar"
import { AdminHeader } from "./admin-header"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect("/admin/login")
  if (user.role !== "ADMIN") redirect("/dashboard")

  return (
    <QueryProvider>
      <SidebarProvider>
        <AdminSidebar name={user.name} email={user.email} />
        <SidebarInset>
          <AdminHeader />
          <div className="flex flex-1 flex-col">
            <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  )
}