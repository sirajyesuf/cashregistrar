"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Landmark } from "lucide-react"
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

type WithholdingReceiptButtonProps = {
  invoiceId: string
  invoiceNumber: string
  businessId?: string
  size?: "default" | "sm" | "lg"
  onIssued?: (receipt: {
    rrn: string | null
    qr: string | null
    status: string | null
  }) => void
}

async function issueWithholdingReceipt(invoiceId: string) {
  const res = await fetch("/api/einvoice/receipt/withholding", {
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
    code?: string
  }
  if (!res.ok || !body.ok) {
    throw body
  }
  return body
}

export function WithholdingReceiptButton({
  invoiceId,
  invoiceNumber,
  businessId,
  size,
  onIssued,
}: WithholdingReceiptButtonProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => issueWithholdingReceipt(invoiceId),
    onSuccess: (data) => {
      toast.add({
        title: "Withholding receipt issued",
        description: `Withholding receipt issued for invoice ${invoiceNumber}.`,
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
      const body = err as { error?: string; code?: string } | null
      const message = body?.error ?? "Could not issue withholding receipt"
      const authError = body?.code === "EIMS_AUTH"
      toast.add({
        title: authError
          ? "Check your MOR credentials"
          : "Could not issue withholding receipt",
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

  const handleIssue = () => {
    if (pending) return
    mutation.mutate()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="outline" size={size} disabled={pending} />}
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Landmark data-icon="inline-start" />
        )}
        {pending ? "Issuing…" : "Issue withholding"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Issue a withholding receipt?</AlertDialogTitle>
          <AlertDialogDescription>
            Issue a withholding receipt for invoice {invoiceNumber} on EIMS?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogCancel onClick={handleIssue} disabled={pending}>
            {pending ? "Issuing…" : "Issue withholding"}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
