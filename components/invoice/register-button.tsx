"use client"

import { useState } from "react"
import { Send, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type RegisterButtonProps = {
  invoiceId: string
  disabled?: boolean
  size?: "default" | "sm" | "lg"
  className?: string
  onRegistered?: (irn: string | null) => void
}

export function RegisterButton({
  invoiceId,
  disabled,
  size,
  className,
  onRegistered,
}: RegisterButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRegister = async () => {
    if (pending) return
    if (!window.confirm("Register this invoice with EIMS?")) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/einvoice/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        irn?: string | null
        error?: string
      }
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `Registration failed (${res.status})`)
      }
      onRegistered?.(body.irn ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size={size}
        onClick={handleRegister}
        disabled={disabled || pending}
        className={className}
      >
        {pending ? (
          <span className="inline-flex items-center gap-1">
            <Send className="size-3.5 animate-pulse" />
            Registering…
          </span>
        ) : error ? (
          <span className="inline-flex items-center gap-1 text-destructive">
            <XCircle className="size-3.5" />
            Retry
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Send className="size-3.5" />
            Register
          </span>
        )}
      </Button>
      {error && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <XCircle className="size-3" />
          {error}
        </span>
      )}
    </span>
  )
}
