"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Building2, Check, Copy, KeyRound } from "lucide-react"
import { copyText } from "@/lib/copy"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { businessEditSchema } from "@/lib/business-schema"
import { REGION_OPTIONS } from "@/lib/regions"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TEST_BUSINESS_NAME,
  TEST_MOR_CREDENTIALS,
  TEST_SELLER_FIELDS,
} from "@/lib/test-mor"

type MorCredentialDetails = {
  tin: string
  vatNumber: string
  systemNumber: string
  systemType: string
  clientId: string
  clientSecret: string
  apiKey: string
}

type BusinessDetails = {
  id: string
  name: string
  address: string | null
  city: string
  email: string | null
  phone: string | null
  region: string | null
  wereda: string | null
  country: string
  houseNumber: string | null
  morCredential: MorCredentialDetails | null
}

type CredentialFieldProps = {
  label: string
  name: string
  value: string
  placeholder?: string
  autoComplete?: string
  isInvalid: boolean
  errors: unknown[]
  onBlur: () => void
  onChange: (value: string) => void
}

function CredentialField({
  label,
  name,
  value,
  placeholder,
  autoComplete,
  isInvalid,
  errors,
  onBlur,
  onChange,
}: CredentialFieldProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await copyText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable; ignore
    }
  }

  return (
    <Field data-invalid={isInvalid} className="sm:col-span-2">
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={name}
          name={name}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={isInvalid}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-sm"
            onClick={copy}
            disabled={!value}
            aria-label={`Copy ${label}`}
            title="Copy to clipboard"
          >
            {copied ? <Check className="text-success" /> : <Copy />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  )
}

function EditBusinessForm({
  businessId,
  initial,
}: {
  businessId: string
  initial: BusinessDetails
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: initial.name,
      address: initial.address ?? "",
      city: initial.city ?? "",
      email: initial.email ?? "",
      phone: initial.phone ?? "",
      region: initial.region ?? "",
      wereda: initial.wereda ?? "",
      country: initial.country ?? "",
      houseNumber: initial.houseNumber ?? "",
      morCredential: {
        tin: initial.morCredential?.tin ?? "",
        vatNumber: initial.morCredential?.vatNumber ?? "",
        clientId: initial.morCredential?.clientId ?? "",
        clientSecret: initial.morCredential?.clientSecret ?? "",
        apiKey: initial.morCredential?.apiKey ?? "",
        systemNumber: initial.morCredential?.systemNumber ?? "",
        systemType: initial.morCredential?.systemType ?? "POS",
      },
    },
    validators: {
      onChange: businessEditSchema,
      onSubmit: businessEditSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        const res = await fetch(`/api/businesses/${businessId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: value.name,
            address: value.address,
            city: value.city,
            email: value.email,
            phone: value.phone,
            region: value.region,
            wereda: value.wereda,
            country: value.country,
            houseNumber: value.houseNumber,
            morCredential: value.morCredential,
          }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        if (!res.ok) {
          throw new Error(
            body.error ?? `Failed to update business (${res.status})`
          )
        }
        await queryClient.invalidateQueries({ queryKey: ["businesses"] })
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
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.setFieldValue("name", TEST_BUSINESS_NAME)
                form.setFieldValue("morCredential", {
                  ...TEST_MOR_CREDENTIALS,
                })
                form.setFieldValue("city", TEST_SELLER_FIELDS.city)
                form.setFieldValue("email", TEST_SELLER_FIELDS.email)
                form.setFieldValue("phone", TEST_SELLER_FIELDS.phone)
                form.setFieldValue("region", TEST_SELLER_FIELDS.region)
                form.setFieldValue("wereda", TEST_SELLER_FIELDS.wereda)
              }}
            >
              Test business
            </Button>
          </div>

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
                    onChange={(event) => field.handleChange(event.target.value)}
                    autoFocus
                    aria-invalid={isInvalid}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="address">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Address</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  autoComplete="street-address"
                />
              </Field>
            )}
          </form.Field>

          <div className="flex items-center gap-2 pt-1">
            <KeyRound className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Seller details</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.Field name="city">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>City</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      autoComplete="address-level2"
                      type="number"
                      min="1"
                      step="1"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="region">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Region</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value ?? "")}
                      items={REGION_OPTIONS}
                    >
                      <SelectTrigger
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                      >
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="wereda">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Wereda</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Wereda / district"
                      type="number"
                      min="1"
                      step="1"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="phone">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Phone</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="e.g. +251900000000"
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid} className="sm:col-span-2">
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
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
                      placeholder="contact@example.com"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="country">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Country</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="e.g. Ethiopia"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="houseNumber">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>House number</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="House / building number"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <KeyRound className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">MOR credentials</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.Field name="morCredential.tin">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
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
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="morCredential.vatNumber">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>VAT number</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    autoComplete="off"
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="morCredential.systemNumber">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>System number</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      autoComplete="off"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="morCredential.systemType">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>System type</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(value ?? "POS")
                    }
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue placeholder="Select system type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ERP">ERP</SelectItem>
                      <SelectItem value="POS">POS</SelectItem>
                      <SelectItem value="MANUAL">MANUAL</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>

            <form.Field name="morCredential.clientId">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <CredentialField
                    label="Client ID"
                    name={field.name}
                    value={field.state.value}
                    placeholder={initial.morCredential ? "••••••••" : ""}
                    autoComplete="off"
                    isInvalid={isInvalid}
                    errors={field.state.meta.errors}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                  />
                )
              }}
            </form.Field>

            <form.Field name="morCredential.clientSecret">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <CredentialField
                    label="Client secret"
                    name={field.name}
                    value={field.state.value}
                    placeholder={initial.morCredential ? "••••••••" : ""}
                    autoComplete="new-password"
                    isInvalid={isInvalid}
                    errors={field.state.meta.errors}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                  />
                )
              }}
            </form.Field>

            <form.Field name="morCredential.apiKey">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <CredentialField
                    label="API key"
                    name={field.name}
                    value={field.state.value}
                    placeholder={initial.morCredential ? "••••••••" : ""}
                    autoComplete="new-password"
                    isInvalid={isInvalid}
                    errors={field.state.meta.errors}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                  />
                )
              }}
            </form.Field>
          </div>

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
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>

        <div className="mt-6 rounded-xl border bg-card">
          <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
            <div className="flex justify-end">
              <Skeleton className="h-6 w-24" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-32" />
            </div>

            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>

            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-28" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-32" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>
    )
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
          <p className="mt-1 text-sm text-muted-foreground">{business.name}</p>
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
