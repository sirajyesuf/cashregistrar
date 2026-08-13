"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Send } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/toast"

type RegisterError = {
  error?: string
  statusCode?: number | null
  code?: string | null
  message?: string
  issues?: { portion?: string; messages?: string[] }[]
  retryAfter?: string | null
  retryAfterSeconds?: number | null
}

type RegisterButtonProps = {
  invoiceId: string
  businessId?: string
  disabled?: boolean
  size?: "default" | "sm" | "lg"
  className?: string
  onRegistered?: (irn: string | null) => void
}

const DEFAULT_RETRY_SECONDS = 5

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
  businessId,
  disabled,
  size,
  className,
  onRegistered,
}: RegisterButtonProps) {
  const queryClient = useQueryClient()
  const [cooldown, setCooldown] = useState(0)

  const mutation = useMutation({
    mutationFn: () => registerInvoice(invoiceId),
    onSuccess: (data) => {
      setCooldown(0)
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoice"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      onRegistered?.(data.irn ?? null)
    },
    onError: (err) => {
      const e = err as RegisterError | null
      if (e?.statusCode === 429) {
        const seconds = e.retryAfterSeconds ?? DEFAULT_RETRY_SECONDS
        setCooldown(seconds)
        toast.add({
          type: "default",
          title: "Too many requests",
          description: `EIMS rate limit reached. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
        })
        return
      }
      const authError = e?.code === "EIMS_AUTH"
      const message = e?.error ?? "Registration failed"
      toast.add({
        type: "destructive",
        title: authError
          ? "Check your MOR credentials"
          : "Registration failed",
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
      })
    },
  })

  const pending = mutation.isPending
  const error = mutation.error as RegisterError | null
  const rateLimited = error?.statusCode === 429

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const waiting = rateLimited && cooldown > 0

  const handleRegister = () => {
    if (pending || waiting) return
    mutation.mutate()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size={size}
            disabled={disabled || pending || waiting}
            className={className}
          />
        }
      >
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Registering…
          </>
        ) : (
          <>
            <Send data-icon="inline-start" />
            Register
          </>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Register this invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            Register this invoice with EIMS?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogCancel onClick={handleRegister} disabled={pending}>
            {pending ? "Registering…" : "Register invoice"}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
