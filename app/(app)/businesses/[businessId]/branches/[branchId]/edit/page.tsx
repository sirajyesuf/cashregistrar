"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Store } from "lucide-react"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { branchCreateSchema } from "@/lib/business-schema"
import { Skeleton } from "@/components/ui/skeleton"

type BranchDetails = {
  id: string
  name: string
  address: string | null
}

function EditBranchForm({
  businessId,
  branchId,
  initial,
}: {
  businessId: string
  branchId: string
  initial: BranchDetails
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: initial.name,
      address: initial.address ?? "",
    },
    validators: {
      onChange: branchCreateSchema,
      onSubmit: branchCreateSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        const res = await fetch(
          `/api/businesses/${businessId}/branches/${branchId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value),
          }
        )
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        if (!res.ok) {
          throw new Error(
            body.error ?? `Failed to update branch (${res.status})`
          )
        }
        await queryClient.invalidateQueries({ queryKey: ["businesses"] })
        toast.add({
          title: "Branch updated",
          description: `${value.name.trim()} was saved.`,
          type: "success",
        })
        router.push("/dashboard")
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update branch"
        setError(message)
        toast.add({
          title: "Could not update branch",
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
                    <FieldError errors={field.state.meta.errors} />
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
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}

export default function EditBranchPage() {
  const params = useParams<{ businessId: string; branchId: string }>()
  const { businessId, branchId } = params
  const [branch, setBranch] = useState<BranchDetails | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/businesses/${businessId}/branches/${branchId}`),
      fetch(`/api/businesses/${businessId}`),
    ])
      .then(async ([branchRes, businessRes]) => {
        const branchBody = (await branchRes.json().catch(() => ({}))) as {
          branch?: BranchDetails
        }
        const businessBody = (await businessRes.json().catch(() => ({}))) as {
          role?: string
        }
        setBranch(branchBody.branch ?? null)
        setRole(businessBody.role ?? null)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [businessId, branchId])

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

  const canEdit = role === "OWNER" || role === "MANAGER"

  if (!branch || !canEdit) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Store className="mx-auto size-6 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Branch access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You don&apos;t have permission to edit this branch.
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
          <h1 className="text-2xl font-bold tracking-tight">Edit branch</h1>
          <p className="mt-1 text-sm text-muted-foreground">{branch.name}</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-3.5" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <EditBranchForm
        businessId={businessId}
        branchId={branchId}
        initial={branch}
      />
    </div>
  )
}
