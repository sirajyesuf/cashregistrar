"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { useForm, type DeepKeysOfType } from "@tanstack/react-form"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Store,
} from "lucide-react"
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspace } from "@/components/workspace-provider"
import {
  createBusinessFormSchema,
  type CreateBusinessFormValues,
} from "@/lib/business-schema"
import { cn } from "@/lib/utils"

type StringField = DeepKeysOfType<CreateBusinessFormValues, string>

type FieldRender = {
  name: string
  state: {
    value: string
    meta: {
      isTouched: boolean
      isValid: boolean
      errors: ReadonlyArray<unknown>
    }
  }
  handleBlur: () => void
  handleChange: (value: string) => void
}

const STEPS = [
  {
    title: "Business",
    description: "Tell us about your business and seller details.",
  },
  {
    title: "MOR credentials",
    description:
      "Connect to the government tax system so invoices can be registered.",
  },
  {
    title: "First branch",
    description: "Choose where this business will issue invoices from.",
  },
] as const

const STEP_FIELDS: StringField[][] = [
  ["name", "address", "city", "region", "wereda", "phone", "email"],
  [
    "morCredential.tin",
    "morCredential.vatNumber",
    "morCredential.systemNumber",
    "morCredential.systemType",
    "morCredential.clientId",
    "morCredential.clientSecret",
    "morCredential.apiKey",
  ],
  ["branch.name", "branch.address"],
]

function FieldInput({
  field,
  label,
  className,
  ...props
}: {
  field: FieldRender
  label: string
  className?: string
} & Omit<
  React.ComponentProps<typeof Input>,
  "name" | "value" | "onBlur" | "onChange"
>) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  return (
    <Field data-invalid={isInvalid} className={className}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={isInvalid}
        {...props}
      />
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}

function FieldSelect({
  field,
  label,
  options,
  placeholder,
}: {
  field: FieldRender
  label: string
  options: string[]
  placeholder: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Select
        value={field.state.value}
        onValueChange={(value) => field.handleChange(value ?? "")}
      >
        <SelectTrigger id={field.name}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  )
}

export function OnboardingFlow() {
  const router = useRouter()
  const { setWorkspace } = useWorkspace()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async (value: CreateBusinessFormValues) => {
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
      return body
    },
    onSuccess: async (body, value) => {
      const business = body.business
      const branchId = business?.branches?.[0]?.id
      if (business?.id && branchId) {
        await setWorkspace({ businessId: business.id, branchId })
      }
      toast.add({
        title: "Business created",
        description: `${value.name.trim()} is ready.`,
        type: "success",
      })
      router.push("/dashboard")
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to create business"
      setError(message)
      toast.add({
        title: "Could not create business",
        description: message,
        type: "destructive",
      })
    },
  })

  const form = useForm({
    defaultValues: {
      name: "",
      address: "",
      city: "",
      email: "",
      phone: "",
      region: "",
      wereda: "",
      morCredential: {
        tin: "",
        vatNumber: "",
        clientId: "",
        clientSecret: "",
        apiKey: "",
        systemNumber: "",
        systemType: "POS",
      },
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
      await createMutation.mutateAsync(value)
    },
  })

  const advance = () => {
    const parsed = createBusinessFormSchema.safeParse(form.state.values)
    const issues = parsed.error?.issues ?? []
    const fields = STEP_FIELDS[step]
    const stepInvalid = fields.some((name) =>
      issues.some((issue) => issue.path.join(".") === name)
    )
    if (stepInvalid) {
      for (const name of fields) {
        const fieldIssues = issues.filter(
          (issue) => issue.path.join(".") === name
        )
        form.setFieldMeta(name, (prev) => ({
          ...prev,
          isTouched: true,
          errorMap: {
            ...prev?.errorMap,
            onChange: fieldIssues.length > 0 ? fieldIssues : undefined,
          },
        }))
      }
      return
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-5 py-4 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Set up your business
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Create your first business and branch to start invoicing.
        </p>
      </div>

      <div className="px-5 pt-5 sm:px-6">
        <ol className="flex items-start gap-2">
          {STEPS.map((stepInfo, index) => {
            const done = index < step
            const active = index === step
            return (
              <li key={stepInfo.title} className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      done || active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                      active && "ring-4 ring-primary/20"
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  {index < STEPS.length - 1 && (
                    <span
                      className={cn(
                        "h-px flex-1",
                        done ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "hidden text-xs font-medium sm:block",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {stepInfo.title}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          {STEPS[step].description}
        </p>
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (step < STEPS.length - 1) {
            advance()
          } else {
            form.handleSubmit().catch(() => {})
          }
        }}
      >
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
          {step === 0 && (
            <>
              <SectionHeader
                icon={<Building2 className="size-4" />}
                title="Business details"
              />
              <form.Field name="name">
                {(field) => (
                  <FieldInput field={field} label="Business name" autoFocus />
                )}
              </form.Field>
              <form.Field name="address">
                {(field) => (
                  <FieldInput
                    field={field}
                    label="Address"
                    autoComplete="street-address"
                  />
                )}
              </form.Field>

              <SectionHeader
                icon={<Store className="size-4" />}
                title="Seller details"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.Field name="city">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="City"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 101"
                    />
                  )}
                </form.Field>
                <form.Field name="region">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="Region"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 13"
                    />
                  )}
                </form.Field>
                <form.Field name="wereda">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="Wereda"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 08"
                    />
                  )}
                </form.Field>
                <form.Field name="phone">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="Phone"
                      placeholder="e.g. +2519XXXXXXXX"
                    />
                  )}
                </form.Field>
                <form.Field name="email">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="Email"
                      type="email"
                      autoComplete="email"
                      placeholder="contact@example.com"
                      className="sm:col-span-2"
                    />
                  )}
                </form.Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <SectionHeader
                icon={<Store className="size-4" />}
                title="MOR credentials"
              />
              <p className="text-sm text-muted-foreground">
                These credentials let CashRegistrar register your invoices with
                the government.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.Field name="morCredential.tin">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="TIN"
                      autoComplete="off"
                    />
                  )}
                </form.Field>
                <form.Field name="morCredential.vatNumber">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="VAT number"
                      autoComplete="off"
                    />
                  )}
                </form.Field>
                <form.Field name="morCredential.systemNumber">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="System number"
                      autoComplete="off"
                    />
                  )}
                </form.Field>
                <form.Field name="morCredential.systemType">
                  {(field) => (
                    <FieldSelect
                      field={field}
                      label="System type"
                      placeholder="Select system type"
                      options={["ERP", "POS", "MANUAL"]}
                    />
                  )}
                </form.Field>
                <form.Field name="morCredential.clientId">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="Client ID"
                      autoComplete="off"
                    />
                  )}
                </form.Field>
                <form.Field name="morCredential.clientSecret">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="Client secret"
                      type="password"
                      autoComplete="off"
                    />
                  )}
                </form.Field>
                <form.Field name="morCredential.apiKey">
                  {(field) => (
                    <FieldInput
                      field={field}
                      label="API key"
                      type="password"
                      autoComplete="off"
                    />
                  )}
                </form.Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <SectionHeader
                icon={<Store className="size-4" />}
                title="First branch"
              />
              <form.Field name="branch.name">
                {(field) => (
                  <FieldInput field={field} label="Branch name" />
                )}
              </form.Field>
              <form.Field name="branch.address">
                {(field) => (
                  <FieldInput
                    field={field}
                    label="Address"
                    autoComplete="street-address"
                  />
                )}
              </form.Field>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending) => (
            <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((current) => current - 1)}
                  disabled={pending}
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </Button>
              ) : (
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </Link>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={advance}>
                  Continue
                  <ArrowRight className="size-3.5" />
                </Button>
              ) : (
                <Button type="submit" disabled={pending}>
                  {pending ? "Creating…" : "Create business"}
                </Button>
              )}
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}
