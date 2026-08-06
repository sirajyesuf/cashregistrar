"use client"

import { useEffect, useState } from "react"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your name and password.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border bg-card p-5"
      >
        <div>
          <Label htmlFor="profileName">Name</Label>
          <Input
            id="profileName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="profileEmail">Email</Label>
          <Input id="profileEmail" value={email} disabled />
          <p className="mt-1 text-xs text-muted-foreground">
            Email cannot be changed.
          </p>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold">Change password</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Leave blank to keep your current password.
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={5}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                At least 5 characters.
              </p>
            </div>
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
