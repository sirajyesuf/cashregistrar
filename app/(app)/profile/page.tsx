"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { toast } from "@/components/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkspace } from "@/components/workspace-provider"

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
}

type Membership = {
  id: string
  name: string
  role: string | null
  branchId: string | null
  branches: { id: string; name: string }[]
}

export default function ProfilePage() {
  const { data: session, isPending } = authClient.useSession()
  const { isPending: workspacePending } = useWorkspace()

  const { data: businesses, isPending: businessesPending } = useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const res = await fetch("/api/businesses")
      if (!res.ok) throw new Error("Could not load businesses")
      const body = (await res.json()) as { businesses: Membership[] }
      return body.businesses
    },
  })

  const [name, setName] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const memberships = businesses ?? []
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return

    const trimmedName = (name ?? session?.user.name ?? "").trim()
    if (!trimmedName) {
      setError("Name is required")
      return
    }
    if (newPassword && !currentPassword) {
      setError("Enter your current password to set a new password")
      return
    }
    if (newPassword && newPassword.length < 5) {
      setError("New password must be at least 5 characters")
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (trimmedName !== session?.user.name) {
        const result = await authClient.updateUser({ name: trimmedName })
        if (result.error) throw new Error(result.error.message)
      }

      if (newPassword) {
        const result = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        })
        if (result.error) throw new Error(result.error.message)
      }

      setCurrentPassword("")
      setNewPassword("")
      toast.add({
        title: "Profile updated",
        description: "Your profile changes were saved.",
        type: "success",
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile"
      setError(message)
      toast.add({
        title: "Could not update profile",
        description: message,
        type: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (isPending) return <Skeleton className="h-24 w-full" />

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your account details and password.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div>
          <p className="text-sm font-semibold">Memberships</p>
          <div className="mt-3 flex flex-col gap-3">
            {workspacePending || businessesPending ? (
              <Skeleton className="h-10 w-full" />
            ) : memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You don&apos;t belong to any business yet.
              </p>
            ) : (
              memberships.map((business) => {
                const branch = business.branches.find(
                  (b) => b.id === business.branchId
                )
                return (
                  <div
                    key={business.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {business.name}
                      </p>
                      {branch && (
                        <p className="truncate text-xs text-muted-foreground">
                          {branch.name}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {business.role && (
                        <Badge variant="outline">
                          {ROLE_LABELS[business.role] ?? business.role}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border bg-card p-5"
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="profileName">Name</FieldLabel>
            <Input
              id="profileName"
              value={name ?? session?.user.name ?? ""}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="profileEmail">Email</FieldLabel>
            <Input
              id="profileEmail"
              value={session?.user.email ?? ""}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed here.
            </p>
          </Field>
        </FieldGroup>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold">Change password</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Leave both password fields blank to keep your current password.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={5}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  At least 5 characters.
                </p>
              </Field>
            </FieldGroup>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
