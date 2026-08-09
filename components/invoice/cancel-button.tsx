"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Ban, Loader2 } from "lucide-react"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"

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
    if (
      !window.confirm(
        `Send a cancellation request for invoice ${invoiceNumber} to EIMS?`
      )
    ) {
      return
    }
    mutation.mutate()
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleCancel}
      disabled={pending}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      {pending ? (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="size-3.5 animate-spin" />
          Cancelling…
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <Ban className="size-3.5" />
          Cancel
        </span>
      )}
    </Button>
  )
}
