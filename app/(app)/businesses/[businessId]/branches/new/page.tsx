"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, Store } from "lucide-react"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { toFieldErrors } from "@/lib/form-errors"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/components/workspace-provider"
import { branchCreateSchema, type BranchCreateValues } from "@/lib/business-schema"
import { Skeleton } from "@/components/ui/skeleton"

export default function AddBranchPage() {
  const router = useRouter()
  const params = useParams<{ businessId: string }>()
  const businessId = params.businessId
  const { setWorkspace } = useWorkspace()
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/businesses/${businessId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load business")
        const body = (await res.json()) as {
          business?: { name: string }
          role?: string
        }
        setBusinessName(body.business?.name ?? null)
        setIsOwner(body.role === "OWNER")
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [businessId])

  const createMutation = useMutation({
    mutationFn: async (value: BranchCreateValues) => {
      const res = await fetch(`/api/businesses/${businessId}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        branch?: { id: string }
      }
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to create branch (${res.status})`)
      }
      return body
    },
    onSuccess: async (body, value) => {
      const branchId = body.branch?.id
      if (branchId) {
        await setWorkspace({ businessId, branchId })
      }
      toast.add({
        title: "Branch created",
        description: `${value.name.trim()} is ready.`,
        type: "success",
      })
      router.push("/dashboard")
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to create branch"
      setError(message)
      toast.add({
        title: "Could not create branch",
        description: message,
        type: "destructive",
      })
    },
  })

  const form = useForm({
    defaultValues: {
      name: "",
      address: "",
    },
    validators: {
      onChange: branchCreateSchema,
      onSubmit: branchCreateSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      await createMutation.mutateAsync(value)
    },
  })

  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>

        <div className="mt-6 rounded-xl border bg-card">
          <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-4 w-64" />
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

  if (!isOwner) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Store className="mx-auto size-6 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Owner access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only the business owner can add branches.
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
          <p className="text-sm text-muted-foreground">
            {businessName ?? "Business"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Add branch</h1>
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
          <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
            <form.Field name="name">
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
                      autoFocus
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                    )}
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
                    onChange={(event) =>
                      field.handleChange(event.target.value)
                    }
                    autoComplete="street-address"
                  />
                  <FieldDescription>
                    A branch is a workspace where invoices are issued.
                  </FieldDescription>
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
                  {pending ? "Creating…" : "Create branch"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  )
}
