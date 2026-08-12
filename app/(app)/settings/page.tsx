"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/toast"

type ProfileForm = {
  businessName: string
  street: string
  city: string
  country: string
  legalName: string
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
  vatNumber: string
  systemNumber: string
  systemType: string
}

const EMPTY_SOURCE: SourceInfo = {
  tin: "",
  vatNumber: "",
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

      {!loaded && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {loaded && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-4">
              <h2 className="text-base font-semibold">Business</h2>
              <p className="text-sm text-muted-foreground">
                This information appears on the invoices you issue.
              </p>
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="businessName">Business Name</FieldLabel>
                <Input
                  id="businessName"
                  value={profile.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                  placeholder="e.g. ABC Trading"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="street">Street</FieldLabel>
                <Input
                  id="street"
                  value={profile.street}
                  onChange={(e) => update("street", e.target.value)}
                  placeholder="e.g. 123 Business Street"
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="city">City</FieldLabel>
                  <Input
                    id="city"
                    value={profile.city}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder="e.g. Addis Ababa"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="country">Country</FieldLabel>
                  <Input
                    id="country"
                    value={profile.country}
                    onChange={(e) => update("country", e.target.value)}
                    placeholder="e.g. Ethiopia"
                  />
                </Field>
              </div>
            </FieldGroup>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="mb-4">
              <h2 className="text-base font-semibold">EIMS Registration</h2>
              <p className="text-sm text-muted-foreground">
                Sent with every invoice registered to the Ministry of Revenue.
              </p>
            </div>

            <Alert className="mb-5 border-dashed">
              <Info />
              <AlertTitle>Source system</AlertTitle>
              <AlertDescription>
                Source system: <strong>{source.systemNumber || "—"}</strong> (
                {source.systemType || "—"}) · Taxpayer TIN:{" "}
                <strong>{source.tin || "—"}</strong> · VAT number:{" "}
                <strong>{source.vatNumber || "—"}</strong>
              </AlertDescription>
            </Alert>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="legalName">Legal Name</FieldLabel>
                <Input
                  id="legalName"
                  value={profile.legalName}
                  onChange={(e) => update("legalName", e.target.value)}
                  placeholder="Registered legal name"
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="contact@example.com"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">Phone</FieldLabel>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="e.g. 0912345678"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="region">Region</FieldLabel>
                  <Input
                    id="region"
                    value={profile.region}
                    onChange={(e) => update("region", e.target.value)}
                    placeholder="e.g. 1"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="subCity">Sub-City</FieldLabel>
                  <Input
                    id="subCity"
                    value={profile.subCity}
                    onChange={(e) => update("subCity", e.target.value)}
                    placeholder="Sub-city"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="wereda">Wereda</FieldLabel>
                  <Input
                    id="wereda"
                    value={profile.wereda}
                    onChange={(e) => update("wereda", e.target.value)}
                    placeholder="Wereda / district"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="houseNumber">House Number</FieldLabel>
                  <Input
                    id="houseNumber"
                    value={profile.houseNumber}
                    onChange={(e) => update("houseNumber", e.target.value)}
                    placeholder="House / building number"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="locality">Locality</FieldLabel>
                  <Input
                    id="locality"
                    value={profile.locality}
                    onChange={(e) => update("locality", e.target.value)}
                    placeholder="Locality"
                  />
                </Field>
              </div>
            </FieldGroup>
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
