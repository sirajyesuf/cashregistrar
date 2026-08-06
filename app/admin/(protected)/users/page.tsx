"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, X } from "lucide-react"
import { toast } from "@/components/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!users) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accounts that can sign in to CashRegistrar.
        </p>
      </div>

      <AddUserForm onCreated={loadUsers} />

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
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
                <td className="px-4 py-2 text-muted-foreground">
                  {user.email}
                </td>
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
    </div>
  )
}

function AddUserForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("user")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName("")
    setEmail("")
    setPassword("")
    setRole("user")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to create user (${res.status})`)
      }
      toast.add({
        title: "User created",
        description: `${name} can now sign in.`,
        type: "success",
      })
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create user"
      setError(message)
      toast.add({
        title: "Could not create user",
        description: message,
        type: "destructive",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card">
      {!open ? (
        <div className="p-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-3.5" />
            Add user
          </Button>
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Add user</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                reset()
              }}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="newUserName">Name</Label>
                <Input
                  id="newUserName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="newUserEmail">Email</Label>
                <Input
                  id="newUserEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="newUserPassword">Password</Label>
                <Input
                  id="newUserPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={5}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  At least 5 characters.
                </p>
              </div>
              <div>
                <Label htmlFor="newUserRole">Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value ?? "user")}
                >
                  <SelectTrigger id="newUserRole">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Adding…" : "Create user"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
