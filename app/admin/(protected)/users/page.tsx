"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, UserRoundCog } from "lucide-react"
import { toast } from "@/components/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authClient } from "@/lib/auth-client"

type AdminUser = {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  _count: { invoices: number }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const currentUserId = session?.user?.id
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)

  const loadUsers = useCallback(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load users")
        const body = (await res.json()) as { users: AdminUser[] }
        setUsers(body.users)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load users")
      )
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleImpersonate = async (user: AdminUser) => {
    if (impersonatingId) return
    setImpersonatingId(user.id)
    try {
      await authClient.admin.impersonateUser({ userId: user.id })
      toast.add({
        title: "Impersonating",
        description: `You are now viewing as ${user.name}.`,
        type: "success",
      })
      router.push("/dashboard")
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Could not impersonate"
      toast.add({
        title: "Could not impersonate",
        description: message,
        type: "destructive",
      })
    } finally {
      setImpersonatingId(null)
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!users) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts that can sign in to CashRegistrar.
          </p>
        </div>
        <Link href="/admin/users/new">
          <Button size="sm">
            <Plus className="size-3.5" />
            Add user
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border bg-card">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Invoices</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              const canImpersonate = !isSelf && user.role !== "ADMIN"
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {user.role === "ADMIN" ? (
                      <Badge variant="success">ADMIN</Badge>
                    ) : (
                      <Badge variant="outline">{user.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {user._count.invoices}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={
                        !canImpersonate || impersonatingId !== null
                      }
                      onClick={() => handleImpersonate(user)}
                      title={
                        isSelf
                          ? "You are already signed in as this user"
                          : user.role === "ADMIN"
                            ? "Cannot impersonate another admin"
                            : "Sign in as this user"
                      }
                    >
                      <UserRoundCog className="size-4" />
                      {impersonatingId === user.id
                        ? "Signing in…"
                        : "Impersonate"}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
