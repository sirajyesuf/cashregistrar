"use client"

import { useState } from "react"
import { Ban, Loader2 } from "lucide-react"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"

type CancelButtonProps = {
  invoiceId: string
  invoiceNumber: string
  size?: "default" | "sm" | "lg"
  onCancelled?: () => void
}

export function CancelButton({
  invoiceId,
  invoiceNumber,
  size,
  onCancelled,
}: CancelButtonProps) {
  const [pending, setPending] = useState(false)

  const handleCancel = async () => {
    if (pending) return
    if (
      !window.confirm(
        `Send a cancellation request for invoice ${invoiceNumber} to EIMS?`
      )
    ) {
      return
    }
    setPending(true)
    try {
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
      toast.add({
        title: "Invoice cancelled",
        description: `Invoice ${invoiceNumber} was cancelled with EIMS.`,
        type: "success",
      })
      onCancelled?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cancellation failed"
      toast.add({
        title: "Could not cancel invoice",
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
