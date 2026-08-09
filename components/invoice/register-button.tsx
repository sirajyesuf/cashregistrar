"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Send, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type RegisterError = {
  error?: string
  statusCode?: number | null
  message?: string
  issues?: { portion?: string; messages?: string[] }[]
}

type RegisterButtonProps = {
  invoiceId: string
  disabled?: boolean
  size?: "default" | "sm" | "lg"
  className?: string
  onRegistered?: (irn: string | null) => void
}

async function registerInvoice(invoiceId: string) {
  const res = await fetch("/api/einvoice/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId }),
  })
  const body = (await res.json().catch(() => ({}))) as RegisterError & {
    ok?: boolean
    irn?: string | null
  }
  if (!res.ok || !body.ok) throw body
  return body as { ok: boolean; irn?: string | null }
}

export function RegisterButton({
  invoiceId,
  disabled,
  size,
  className,
  onRegistered,
}: RegisterButtonProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => registerInvoice(invoiceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoice"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      onRegistered?.(data.irn ?? null)
    },
  })

  const pending = mutation.isPending
  const error = mutation.error as RegisterError | null

  const handleRegister = () => {
    if (pending) return
    if (!window.confirm("Register this invoice with EIMS?")) return
    mutation.mutate()
  }

  const headline =
    error?.message && error.message !== "EIMS request failed"
      ? error.message
      : error?.error

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
        <span className="flex max-w-xs flex-col items-end gap-0.5 text-right text-xs text-destructive">
          <span className="inline-flex items-center gap-1">
            <XCircle className="size-3 shrink-0" />
            <span className="font-medium">{headline}</span>
          </span>
          {error.issues && error.issues.length > 0 && (
            <ul className="space-y-0.5">
              {error.issues.map((issue, i) => (
                <li key={i}>
                  {issue.portion && (
                    <span className="font-medium">{issue.portion}: </span>
                  )}
                  {issue.messages?.join(" ")}
                </li>
              ))}
            </ul>
          )}
        </span>
      )}
    </span>
  )
}
