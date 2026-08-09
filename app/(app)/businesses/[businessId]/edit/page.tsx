"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { ArrowLeft, Building2 } from "lucide-react"
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { businessCreateSchema } from "@/lib/business-schema"

type BusinessDetails = {
  id: string
  name: string
  tin: string | null
  vatNumber: string | null
  address: string | null
}

function EditBusinessForm({
  businessId,
  initial,
}: {
  businessId: string
  initial: BusinessDetails
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: initial.name,
      tin: initial.tin ?? "",
      vatNumber: initial.vatNumber ?? "",
      address: initial.address ?? "",
    },
    validators: {
      onChange: businessCreateSchema,
      onSubmit: businessCreateSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        const res = await fetch(`/api/businesses/${businessId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        })
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        if (!res.ok) {
          throw new Error(
            body.error ?? `Failed to update business (${res.status})`
          )
        }
        toast.add({
          title: "Business updated",
          description: `${value.name.trim()} was saved.`,
          type: "success",
        })
        router.push("/dashboard")
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update business"
        setError(message)
        toast.add({
          title: "Could not update business",
          description: message,
          type: "destructive",
        })
      }
    },
  })

  return (
    <div className="mt-6 rounded-xl border bg-card">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          form.handleSubmit().catch(() => {})
        }}
      >
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Business details</h2>
          </div>

          <form.Field name="name">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Business name</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(event.target.value)
                    }
                    autoFocus
                    aria-invalid={isInvalid}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.Field name="tin">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>TIN</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(event.target.value)
                    }
                    autoComplete="off"
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="vatNumber">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>VAT number</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(event.target.value)
                    }
                    autoComplete="off"
                  />
                </Field>
              )}
            </form.Field>
          </div>

          <form.Field name="address">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Address</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(event.target.value)
                  }
                  autoComplete="street-address"
                />
              </Field>
            )}
          </form.Field>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending) => (
            <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Link href="/dashboard">
                <Button type="button" variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}

export default function EditBusinessPage() {
  const params = useParams<{ businessId: string }>()
  const businessId = params.businessId
  const [business, setBusiness] = useState<BusinessDetails | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/businesses/${businessId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load business")
        const body = (await res.json()) as {
          business: BusinessDetails | null
          role?: string
        }
        setBusiness(body.business)
        setRole(body.role ?? null)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [businessId])

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (!business || role !== "OWNER") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Building2 className="mx-auto size-6 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Owner access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only the business owner can edit business details.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit business</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {business.name}
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-3.5" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <EditBusinessForm businessId={businessId} initial={business} />
    </div>
  )
}
