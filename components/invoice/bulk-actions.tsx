"use client"

import { useMemo, useState } from "react"
import { Ban, Send, Trash2, TriangleAlert, X } from "lucide-react"
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
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

  const open = mode !== null

  const close = (next: boolean) => {
    if (!next && !pending) setMode(null)
  }

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
            <Send data-icon="inline-start" />
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
            <Ban data-icon="inline-start" />
            Cancel {cancellable.length}
          </Button>
        )}
        {deletable.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting || pending}
                />
              }
            >
              <Trash2 data-icon="inline-start" />
              {deleting ? "Deleting…" : `Delete ${deletable.length}`}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete selected invoices?</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete {deletable.length} selected invoice
                  {deletable.length === 1 ? "" : "s"}? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep them</AlertDialogCancel>
                <AlertDialogCancel
                  variant="destructive"
                  onClick={onDelete}
                  disabled={deleting || pending}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

      <Dialog open={open} onOpenChange={close}>
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>
              {mode === "register"
                ? "Register invoices?"
                : "Cancel invoices?"}
            </DialogTitle>
            <DialogDescription>
              {mode === "register"
                ? "These invoices will be sent to EIMS together. They cannot be edited while processing."
                : "Cancellation is sent to EIMS for each selected registered invoice. This action may not be reversible."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
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
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>EIMS rejected the request</AlertTitle>
              <AlertDescription>
                <Collapsible className="mt-2">
                  <CollapsibleTrigger className="text-xs font-medium underline">
                    Full EIMS response
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap text-foreground">
                      {JSON.stringify(errorResponse, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </AlertDescription>
            </Alert>
          )}

          {mode === "cancel" && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="bulk-reason-code">Reason code</FieldLabel>
                <Select
                  value={reasonCode}
                  onValueChange={(value) => setReasonCode(value ?? "1")}
                >
                  <SelectTrigger id="bulk-reason-code">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Duplicate invoice</SelectItem>
                    <SelectItem value="2">Data error</SelectItem>
                    <SelectItem value="6">Calculation error</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-remark">
                  Remark{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FieldLabel>
                <Textarea
                  id="bulk-remark"
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Add context for the cancellation"
                />
              </Field>
            </FieldGroup>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />} disabled={pending}>
              Keep selected
            </DialogClose>
            <Button onClick={submit} disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : mode === "register" ? (
                <Send data-icon="inline-start" />
              ) : (
                <Ban data-icon="inline-start" />
              )}
              {pending
                ? "Submitting…"
                : mode === "register"
                  ? "Submit registration"
                  : "Submit cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
