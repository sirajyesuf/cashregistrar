"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { Store } from "lucide-react"
import { createBusinessFormSchema } from "@/lib/business-schema"

export default function AddBusinessPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: "",
      tin: "",
      vatNumber: "",
      address: "",
      branch: {
        name: "Main Branch",
        address: "",
      },
    },
    validators: {
      onChange: createBusinessFormSchema,
      onSubmit: createBusinessFormSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        const res = await fetch("/api/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        })
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          business?: { id: string; branches: { id: string }[] }
        }
        if (!res.ok) {
          throw new Error(
            body.error ?? `Failed to create business (${res.status})`
          )
        }
        const business = body.business
        const branchId = business?.branches?.[0]?.id
        if (business?.id && branchId) {
          await fetch("/api/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: business.id,
              branchId,
            }),
          })
        }
        toast.add({
          title: "Business created",
          description: `${value.name.trim()} is ready.`,
          type: "success",
        })
        router.push("/dashboard")
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create business"
        setError(message)
        toast.add({
          title: "Could not create business",
          description: message,
          type: "destructive",
        })
      }
    },
  })

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add business</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a business and its first branch.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-3.5" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

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
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
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

            <div className="flex items-center gap-2 pt-1">
              <Store className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">First branch</h2>
            </div>

            <form.Field name="branch.name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Branch name</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="branch.address">
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
                  {pending ? "Creating…" : "Create business"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  )
}
