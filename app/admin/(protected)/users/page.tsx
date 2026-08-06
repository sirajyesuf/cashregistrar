"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"

type AdminUser = {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  _count: { invoices: number }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load users")
        const body = (await res.json()) as { users: AdminUser[] }
        setUsers(body.users)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load users")
      )
  }, [])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!users) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 text-right font-medium">Invoices</th>
            <th className="px-4 py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b last:border-0">
              <td className="px-4 py-2 font-medium">{user.name}</td>
              <td className="px-4 py-2 text-muted-foreground">{user.email}</td>
              <td className="px-4 py-2">
                {user.role === "admin" ? (
                  <Badge variant="success">admin</Badge>
                ) : (
                  <Badge variant="outline">user</Badge>
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {user._count.invoices}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
