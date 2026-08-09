"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Receipt as ReceiptIcon } from "lucide-react"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"

type ReceiptButtonProps = {
  invoiceId: string
  invoiceNumber: string
  size?: "default" | "sm" | "lg"
  onIssued?: (receipt: {
    rrn: string | null
    qr: string | null
    status: string | null
  }) => void
}

async function issueReceipt(invoiceId: string) {
  const res = await fetch("/api/einvoice/receipt/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    rrn?: string | null
    qr?: string | null
    status?: string | null
    error?: string
  }
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `Receipt failed (${res.status})`)
  }
  return body
}

export function ReceiptButton({
  invoiceId,
  invoiceNumber,
  size,
  onIssued,
}: ReceiptButtonProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => issueReceipt(invoiceId),
    onSuccess: (data) => {
      toast.add({
        title: "Receipt issued",
        description: `Sales receipt issued for invoice ${invoiceNumber}.`,
        type: "success",
      })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoice"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      onIssued?.({
        rrn: data.rrn ?? null,
        qr: data.qr ?? null,
        status: data.status ?? null,
      })
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Could not issue receipt"
      toast.add({
        title: "Could not issue receipt",
        description: message,
        type: "destructive",
      })
    },
  })

  const pending = mutation.isPending

  const handleIssue = () => {
    if (pending) return
    if (
      !window.confirm(
        `Issue a sales receipt for invoice ${invoiceNumber} on EIMS?`
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
      onClick={handleIssue}
      disabled={pending}
    >
      <ReceiptIcon className="size-3.5" />
      {pending ? "Issuing…" : "Issue receipt"}
    </Button>
  )
}
