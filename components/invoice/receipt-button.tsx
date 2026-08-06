"use client"

import { useState } from "react"
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

export function ReceiptButton({
  invoiceId,
  invoiceNumber,
  size,
  onIssued,
}: ReceiptButtonProps) {
  const [pending, setPending] = useState(false)

  const handleIssue = async () => {
    if (pending) return
    if (
      !window.confirm(
        `Issue a sales receipt for invoice ${invoiceNumber} on EIMS?`
      )
    ) {
      return
    }
    setPending(true)
    try {
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
      toast.add({
        title: "Receipt issued",
        description: `Sales receipt issued for invoice ${invoiceNumber}.`,
        type: "success",
      })
      onIssued?.({
        rrn: body.rrn ?? null,
        qr: body.qr ?? null,
        status: body.status ?? null,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not issue receipt"
      toast.add({
        title: "Could not issue receipt",
        description: message,
        type: "destructive",
      })
    } finally {
      setPending(false)
    }
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
