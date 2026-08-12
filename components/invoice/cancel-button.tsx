"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
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

type CancelButtonProps = {
  invoiceId: string
  invoiceNumber: string
  size?: "default" | "sm" | "lg"
  onCancelled?: () => void
}

async function cancelInvoice(invoiceId: string) {
  const res = await fetch("/api/einvoice/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
  }
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `Cancellation failed (${res.status})`)
  }
}

export function CancelButton({
  invoiceId,
  invoiceNumber,
  size,
  onCancelled,
}: CancelButtonProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => cancelInvoice(invoiceId),
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
      const message =
        err instanceof Error ? err.message : "Cancellation failed"
      toast.add({
        title: "Could not cancel invoice",
        description: message,
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
