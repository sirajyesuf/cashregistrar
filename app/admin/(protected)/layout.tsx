import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/user"
import { AdminSidebar } from "./admin-sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect("/admin/login")
  if (user.role !== "ADMIN") redirect("/dashboard")

  return (
    <div className="min-h-svh bg-background">
      <AdminSidebar name={user.name} email={user.email} />
      <main className="mx-auto max-w-6xl p-4 sm:p-6 md:ml-64">{children}</main>
    </div>
  )
}
