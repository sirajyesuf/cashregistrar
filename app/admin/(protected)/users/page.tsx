"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, UserRoundCog, X } from "lucide-react"
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accounts that can sign in to CashRegistrar.
        </p>
      </div>

      <AddUserForm onCreated={loadUsers} />

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

function AddUserForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("OWNER")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName("")
    setEmail("")
    setPassword("")
    setRole("OWNER")
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
                  onValueChange={(value) => setRole(value ?? "OWNER")}
                >
                  <SelectTrigger id="newUserRole">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">OWNER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
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
