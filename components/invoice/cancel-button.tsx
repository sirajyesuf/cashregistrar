"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Ban } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  CANCELLATION_REASON_OPTIONS,
  DEFAULT_CANCELLATION_REASON,
  type CancellationReason,
} from "@/lib/einvoice/cancellation-reason"

type CancelButtonProps = {
  invoiceId: string
  invoiceNumber: string
  businessId?: string
  size?: "default" | "sm" | "lg"
  onCancelled?: () => void
}

async function cancelInvoice(
  invoiceId: string,
  reason: CancellationReason,
  remark: string
) {
  const res = await fetch("/api/einvoice/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId, reason, remark }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    code?: string
  }
  if (!res.ok || !body.ok) {
    throw body
  }
}

export function CancelButton({
  invoiceId,
  invoiceNumber,
  businessId,
  size,
  onCancelled,
}: CancelButtonProps) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState<CancellationReason>(
    DEFAULT_CANCELLATION_REASON
  )
  const [remark, setRemark] = useState("")

  const mutation = useMutation({
    mutationFn: () => cancelInvoice(invoiceId, reason, remark.trim()),
    onSuccess: () => {
      toast.add({
        title: "Invoice cancelled",
        description: `Invoice ${invoiceNumber} was cancelled with EIMS.`,
        type: "success",
      })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoice"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      onCancelled?.()
    },
    onError: (err) => {
      const body = err as { error?: string; code?: string } | null
      const message = body?.error ?? "Cancellation failed"
      const authError = body?.code === "EIMS_AUTH"
      toast.add({
        title: authError
          ? "Check your MOR credentials"
          : "Could not cancel invoice",
        description: authError ? (
          <>
            {message}{" "}
            {businessId && (
              <Link
                href={`/businesses/${businessId}/edit`}
                className="font-medium underline underline-offset-2"
              >
                Fix credentials
              </Link>
            )}
          </>
        ) : (
          message
        ),
        type: "destructive",
      })
    },
  })

  const pending = mutation.isPending

  const handleCancel = () => {
    if (pending) return
    mutation.mutate()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="destructive" size={size} disabled={pending} />}
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Ban data-icon="inline-start" />
        )}
        {pending ? "Cancelling…" : "Cancel"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            Send a cancellation request for invoice {invoiceNumber} to EIMS?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cancel-reason">Reason</FieldLabel>
            <Select
              value={reason}
              onValueChange={(value) =>
                setReason(
                  (value as CancellationReason) ?? DEFAULT_CANCELLATION_REASON
                )
              }
              items={CANCELLATION_REASON_OPTIONS}
            >
              <SelectTrigger id="cancel-reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="cancel-remark">
              Remark{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </FieldLabel>
            <Textarea
              id="cancel-remark"
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add context for the cancellation"
            />
          </Field>
        </FieldGroup>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep invoice</AlertDialogCancel>
          <AlertDialogCancel
            variant="destructive"
            onClick={handleCancel}
            disabled={pending}
          >
            {pending ? "Cancelling…" : "Cancel invoice"}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
