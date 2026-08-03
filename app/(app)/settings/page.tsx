"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ProfileForm = {
  businessName: string
  street: string
  city: string
  country: string
}

const EMPTY_PROFILE: ProfileForm = {
  businessName: "",
  street: "",
  city: "",
  country: "",
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/settings/seller")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load settings")
        const body = (await res.json()) as { profile: ProfileForm }
        setProfile(body.profile)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load settings")
      )
      .finally(() => setLoaded(true))
  }, [])

  const update = (field: keyof ProfileForm, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
    setMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/settings/seller", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
      }
      if (!res.ok) throw new Error(body.error ?? "Failed to save settings")
      setMessage("Business settings saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Business Settings</h1>
        <Link href="/invoices">
          <Button variant="outline">Back to Invoices</Button>
        </Link>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        This information appears on the invoices you issue.
      </p>

      {!loaded && <p className="text-sm text-muted-foreground">Loading…</p>}

      {loaded && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="businessName" className="text-sm font-medium">
              Business Name
            </label>
            <Input
              id="businessName"
              value={profile.businessName}
              onChange={(e) => update("businessName", e.target.value)}
              placeholder="e.g. ABC Trading"
              required
            />
          </div>
          <div>
            <label htmlFor="street" className="text-sm font-medium">
              Street
            </label>
            <Input
              id="street"
              value={profile.street}
              onChange={(e) => update("street", e.target.value)}
              placeholder="e.g. 123 Business Street"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="text-sm font-medium">
                City
              </label>
              <Input
                id="city"
                value={profile.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="e.g. Addis Ababa"
              />
            </div>
            <div>
              <label htmlFor="country" className="text-sm font-medium">
                Country
              </label>
              <Input
                id="country"
                value={profile.country}
                onChange={(e) => update("country", e.target.value)}
                placeholder="e.g. Ethiopia"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saving || !profile.businessName.trim()}>
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
