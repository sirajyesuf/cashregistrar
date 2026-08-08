"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { Eye, EyeOff, Plus, UserRoundCog, X } from "lucide-react"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { toast } from "@/components/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
import { adminUserSchema } from "@/lib/admin-user-schema"

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
  const [showPassword, setShowPassword] = useState(false)
  const [submitMode, setSubmitMode] = useState<"close" | "another">("close")
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "OWNER" as "ADMIN" | "OWNER",
    },
    validators: {
      onChange: adminUserSchema,
      onSubmit: adminUserSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        })
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        if (!res.ok) {
          throw new Error(body.error ?? `Failed to create user (${res.status})`)
        }

        toast.add({
          title: "User created",
          description: `${value.name.trim()} can now sign in.`,
          type: "success",
        })
        form.reset()
        setShowPassword(false)
        onCreated()
        if (submitMode === "close") setOpen(false)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create user"
        setError(message)
        toast.add({
          title: "Could not create user",
          description: message,
          type: "destructive",
        })
      }
    },
  })

  const reset = () => {
    form.reset()
    setShowPassword(false)
    setSubmitMode("close")
    setError(null)
  }

  const closePanel = () => {
    setOpen(false)
    reset()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <Dialog.Trigger
        render={<Button type="button" size="sm" />}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" />
        Add user
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-card shadow-2xl outline-none sm:border-l">
          <div className="flex items-start justify-between border-b px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold">
                Add user
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Create an account that can sign in to CashRegistrar.
              </Dialog.Description>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closePanel}
              aria-label="Close add user panel"
              className="-mr-2 -mt-1"
            >
              <X className="size-4" />
            </Button>
          </div>

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              form.handleSubmit().catch(() => {})
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="space-y-4">
                <form.Field name="name">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Full name</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          autoFocus
                          autoComplete="name"
                          aria-invalid={isInvalid}
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    )
                  }}
                </form.Field>

                <form.Field name="email">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Email address</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="email"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          autoComplete="email"
                          aria-invalid={isInvalid}
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    )
                  }}
                </form.Field>

                <form.Field name="password">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          Temporary password
                        </FieldLabel>
                        <div className="relative">
                          <Input
                            id={field.name}
                            name={field.name}
                            type={showPassword ? "text" : "password"}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            className="pr-11"
                            autoComplete="new-password"
                            aria-invalid={isInvalid}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowPassword((visible) => !visible)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute top-1/2 right-1 -translate-y-1/2"
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </Button>
                        </div>
                        <FieldDescription>
                          At least 5 characters. Share it securely with the user.
                        </FieldDescription>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    )
                  }}
                </form.Field>
              </div>

              <form.Field name="role">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                    const description =
                      field.state.value === "ADMIN"
                        ? "Can manage the entire CashRegistrar platform."
                        : "Can create and manage a business."
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Account role</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(value === "ADMIN" ? "ADMIN" : "OWNER")
                        }
                      >
                        <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OWNER">Owner</SelectItem>
                          <SelectItem value="ADMIN">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldDescription>{description}</FieldDescription>
                      <FieldDescription>
                        Managers and cashiers are assigned later inside a business.
                      </FieldDescription>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )
                }}
              </form.Field>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <div className="flex flex-col gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closePanel} disabled={pending}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setSubmitMode("another")}
                  >
                    {pending && submitMode === "another"
                      ? "Creating…"
                      : "Create and add another"}
                  </Button>
                  <Button
                    type="submit"
                    disabled={pending}
                    onClick={() => setSubmitMode("close")}
                  >
                    {pending && submitMode === "close" ? "Creating…" : "Create user"}
                  </Button>
                </div>
              )}
            </form.Subscribe>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
