"use client"

import { useEffect, useState } from "react"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminProfilePage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/profile")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load profile")
        const body = (await res.json()) as {
          profile: { name: string; email: string }
        }
        setName(body.profile.name)
        setEmail(body.profile.email)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load profile")
      )
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save profile")
      }
      toast.add({
        title: "Profile updated",
        description: "Your changes were saved.",
        type: "success",
      })
      setCurrentPassword("")
      setNewPassword("")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save profile"
      setError(message)
      toast.add({
        title: "Could not save profile",
        description: message,
        type: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-24 w-full" />

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your name and password.
        </p>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="profileEmail">Email</FieldLabel>
            <Input id="profileEmail" value={email} disabled />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed.
            </p>
          </Field>
        </FieldGroup>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold">Change password</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Leave blank to keep your current password.
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
