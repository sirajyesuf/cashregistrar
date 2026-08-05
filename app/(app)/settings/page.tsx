"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/toast"

type ProfileForm = {
  businessName: string
  street: string
  city: string
  country: string
  legalName: string
  tin: string
  vatNumber: string
  email: string
  phone: string
  region: string
  subCity: string
  wereda: string
  houseNumber: string
  locality: string
}

const EMPTY_PROFILE: ProfileForm = {
  businessName: "",
  street: "",
  city: "",
  country: "",
  legalName: "",
  tin: "",
  vatNumber: "",
  email: "",
  phone: "",
  region: "",
  subCity: "",
  wereda: "",
  houseNumber: "",
  locality: "",
}

type SourceInfo = {
  tin: string
  systemNumber: string
  systemType: string
}

const EMPTY_SOURCE: SourceInfo = {
  tin: "",
  systemNumber: "",
  systemType: "",
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE)
  const [source, setSource] = useState<SourceInfo>(EMPTY_SOURCE)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/settings/seller")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load settings")
        const body = (await res.json()) as {
          profile: Partial<ProfileForm>
          source?: Partial<SourceInfo>
        }
        setProfile({ ...EMPTY_PROFILE, ...body.profile })
        setSource({ ...EMPTY_SOURCE, ...body.source })
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load settings")
      )
      .finally(() => setLoaded(true))
  }, [])

  const update = (field: keyof ProfileForm, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
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
      toast.add({
        title: "Settings saved",
        description: "Your business details were updated successfully.",
        type: "success",
      })
    } catch (err) {
      toast.add({
        title: "Could not save settings",
        description:
          err instanceof Error ? err.message : "Failed to save settings",
        type: "destructive",
      })
      setError(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Business Settings</h1>
        <Link href="/invoices">
          <Button variant="outline">Back to Invoices</Button>
        </Link>
      </div>

      {!loaded && <p className="text-sm text-muted-foreground">Loading…</p>}

      {loaded && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-lg border p-4">
            <h2 className="mb-4 text-base font-semibold">Business</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              This information appears on the invoices you issue.
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={profile.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                  placeholder="e.g. ABC Trading"
                  required
                />
              </div>
              <div>
                <Label htmlFor="street">Street</Label>
                <Input
                  id="street"
                  value={profile.street}
                  onChange={(e) => update("street", e.target.value)}
                  placeholder="e.g. 123 Business Street"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={profile.city}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder="e.g. Addis Ababa"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={profile.country}
                    onChange={(e) => update("country", e.target.value)}
                    placeholder="e.g. Ethiopia"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-1 text-base font-semibold">EIMS Registration</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Sent with every invoice registered to the Ministry of Revenue.
            </p>

            <div className="mb-5 flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span className="space-x-3">
                <span>
                  Source system: <strong>{source.systemNumber || "—"}</strong> (
                  {source.systemType || "—"})
                </span>
                <span>
                  Taxpayer TIN: <strong>{source.tin || "—"}</strong>
                </span>
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="legalName">Legal Name</Label>
                  <Input
                    id="legalName"
                    value={profile.legalName}
                    onChange={(e) => update("legalName", e.target.value)}
                    placeholder="Registered legal name"
                  />
                </div>
                <div>
                  <Label htmlFor="vatNumber">VAT Number</Label>
                  <Input
                    id="vatNumber"
                    value={profile.vatNumber}
                    onChange={(e) => update("vatNumber", e.target.value)}
                    placeholder="VAT registration number"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="contact@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="e.g. 0912345678"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    value={profile.region}
                    onChange={(e) => update("region", e.target.value)}
                    placeholder="e.g. 13"
                  />
                </div>
                <div>
                  <Label htmlFor="subCity">Sub-City</Label>
                  <Input
                    id="subCity"
                    value={profile.subCity}
                    onChange={(e) => update("subCity", e.target.value)}
                    placeholder="Sub-city"
                  />
                </div>
                <div>
                  <Label htmlFor="wereda">Wereda</Label>
                  <Input
                    id="wereda"
                    value={profile.wereda}
                    onChange={(e) => update("wereda", e.target.value)}
                    placeholder="Wereda / district"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="houseNumber">House Number</Label>
                  <Input
                    id="houseNumber"
                    value={profile.houseNumber}
                    onChange={(e) => update("houseNumber", e.target.value)}
                    placeholder="House / building number"
                  />
                </div>
                <div>
                  <Label htmlFor="locality">Locality</Label>
                  <Input
                    id="locality"
                    value={profile.locality}
                    onChange={(e) => update("locality", e.target.value)}
                    placeholder="Locality"
                  />
                </div>
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={saving || !profile.businessName.trim()}
            >
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
