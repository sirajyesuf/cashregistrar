"use client"

import { useEffect, useMemo, useState } from "react"
import { Ban, Loader2, Send, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/toast"
import { hasIssuedReceipt } from "@/lib/invoice"

type BulkInvoice = {
  id: string
  number: string
  registrationStatus?: string | null
  receipt?: { status?: string | null } | null
}

type BulkActionsProps = {
  invoices: BulkInvoice[]
  onClear: () => void
  onDelete: () => void
  onSubmitted: () => void
  deleting?: boolean
}

type DialogMode = "register" | "cancel" | null

function canRegister(invoice: BulkInvoice): boolean {
  return (
    invoice.registrationStatus !== "REGISTERED" &&
    invoice.registrationStatus !== "CANCELLED" &&
    invoice.registrationStatus !== "PROCESSING"
  )
}

function canCancel(invoice: BulkInvoice): boolean {
  return (
    invoice.registrationStatus === "REGISTERED" && !hasIssuedReceipt(invoice)
  )
}

function canDelete(invoice: BulkInvoice): boolean {
  return (
    invoice.registrationStatus !== "REGISTERED" &&
    invoice.registrationStatus !== "PROCESSING" &&
    !hasIssuedReceipt(invoice)
  )
}

export function BulkActions({
  invoices,
  onClear,
  onDelete,
  onSubmitted,
  deleting = false,
}: BulkActionsProps) {
  const [mode, setMode] = useState<DialogMode>(null)
  const [reasonCode, setReasonCode] = useState("1")
  const [remark, setRemark] = useState("")
  const [pending, setPending] = useState(false)
  const [errorResponse, setErrorResponse] = useState<unknown>(null)

  const registerable = useMemo(() => invoices.filter(canRegister), [invoices])
  const cancellable = useMemo(() => invoices.filter(canCancel), [invoices])
  const deletable = useMemo(() => invoices.filter(canDelete), [invoices])

  useEffect(() => {
    if (!mode) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setMode(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [mode, pending])

  const submit = async () => {
    const target = mode === "register" ? registerable : cancellable
    if (!mode || target.length === 0 || pending) return

    setPending(true)
    try {
      const response = await fetch(
        mode === "register"
          ? "/api/einvoice/bulk-register"
          : "/api/einvoice/bulk-cancel",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "register"
              ? { invoiceIds: target.map((invoice) => invoice.id) }
              : {
                  invoiceIds: target.map((invoice) => invoice.id),
                  reasonCode,
                  remark: remark.trim(),
                }
          ),
        }
      )
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        statusCode?: number
        retryAfter?: string | null
        conversationId?: string
        operationId?: string
        count?: number
        succeeded?: number
        failed?: number
        detail?: unknown
      }
      if (!response.ok || !body.ok) {
        setErrorResponse({
          httpStatus: response.status,
          response: body,
        })
        const status = body.statusCode ? ` (EIMS ${body.statusCode})` : ""
        throw new Error(
          `${body.error ?? `Bulk ${mode} failed (${response.status})`}${status}`
        )
      }

      if (mode === "cancel") {
        const total = body.count ?? target.length
        const succeeded = body.succeeded ?? 0
        const failed = body.failed ?? 0
        toast.add({
          type: "success",
          title: "Cancellation complete",
          description: `${succeeded} of ${total} invoice${total === 1 ? "" : "s"} cancelled${failed > 0 ? `, ${failed} failed` : ""}.`,
        })
      } else {
        toast.add({
          type: "success",
          title: "Registration submitted",
          description: `${body.count ?? target.length} invoice${(body.count ?? target.length) === 1 ? "" : "s"} sent to EIMS. Results will appear when processing finishes.`,
        })
      }
      setMode(null)
      setErrorResponse(null)
      setRemark("")
      onSubmitted()
    } catch (error) {
      toast.add({
        type: "destructive",
        title: "Bulk action failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5 shadow-sm sm:px-4">
        <div className="mr-auto flex items-center gap-2 text-sm">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {invoices.length}
          </span>
          <span className="font-medium">selected</span>
        </div>
        {registerable.length > 0 && (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setErrorResponse(null)
              setMode("register")
            }}
            disabled={pending}
          >
            <Send />
            Register {registerable.length}
          </Button>
        )}
        {cancellable.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setErrorResponse(null)
              setMode("cancel")
            }}
            disabled={pending}
          >
            <Ban />
            Cancel {cancellable.length}
          </Button>
        )}
        {deletable.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={deleting || pending}
          >
            <Trash2 />
            {deleting ? "Deleting…" : `Delete ${deletable.length}`}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          disabled={pending}
          aria-label="Clear selected invoices"
          title="Clear selection"
        >
          <X />
        </Button>
      </div>

      {mode && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 backdrop-blur-[2px] sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setMode(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-action-title"
            className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  EIMS bulk action
                </p>
                <h2
                  id="bulk-action-title"
                  className="mt-1 text-lg font-semibold tracking-tight"
                >
                  {mode === "register"
                    ? "Register invoices?"
                    : "Cancel invoices?"}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMode(null)}
                disabled={pending}
                aria-label="Close dialog"
              >
                <X />
              </Button>
            </div>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "register"
                ? "These invoices will be sent to EIMS together. They cannot be edited while processing."
                : "Cancellation is sent to EIMS for each selected registered invoice. This action may not be reversible."}
            </p>

            <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
              <span className="font-medium">
                {mode === "register" ? registerable.length : cancellable.length}
              </span>{" "}
              invoice
              {(mode === "register"
                ? registerable.length
                : cancellable.length) === 1
                ? ""
                : "s"}{" "}
              selected
            </div>

            {errorResponse !== null && (
              <details
                open
                className="mt-4 overflow-hidden rounded-lg border border-destructive/30 bg-destructive/[0.04]"
              >
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                  Full EIMS response
                </summary>
                <pre className="max-h-56 overflow-auto border-t border-destructive/20 px-3 py-3 font-mono text-[11px] leading-5 whitespace-pre-wrap text-foreground">
                  {JSON.stringify(errorResponse, null, 2)}
                </pre>
              </details>
            )}

            {mode === "cancel" && (
              <div className="mt-4 grid gap-3">
                <label
                  className="grid gap-1.5 text-sm font-medium"
                  htmlFor="bulk-reason-code"
                >
                  Reason code
                  <select
                    id="bulk-reason-code"
                    value={reasonCode}
                    onChange={(event) => setReasonCode(event.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-3 font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    <option value="1">Duplicate invoice</option>
                    <option value="2">Data error</option>
                    <option value="6">Calculation error</option>
                  </select>
                </label>
                <label
                  className="grid gap-1.5 text-sm font-medium"
                  htmlFor="bulk-remark"
                >
                  Remark{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                  <textarea
                    id="bulk-remark"
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Add context for the cancellation"
                    className="resize-none rounded-lg border border-input bg-background px-3 py-2 font-normal outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                </label>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setMode(null)}
                disabled={pending}
              >
                Keep selected
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : mode === "register" ? (
                  <Send />
                ) : (
                  <Ban />
                )}
                {pending
                  ? "Submitting…"
                  : mode === "register"
                    ? "Submit registration"
                    : "Submit cancellation"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
