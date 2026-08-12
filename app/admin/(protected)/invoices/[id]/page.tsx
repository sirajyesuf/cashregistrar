"use client"

import { useEffect, useState } from "react"
import { Building2, Check, ChevronDown, Copy, TriangleAlert, User } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { copyText } from "@/lib/copy"
import { unitLabel } from "@/lib/units"
import { taxCodeLabel } from "@/lib/einvoice/tax"
import { formatCents, moneyToCents } from "@/lib/invoice"
import { StatusBadge } from "../../status-badge"
import type { TransactionType } from "@/lib/invoice"

type AdminInvoiceView = {
  id: string
  number: string
  date: string
  taxCode: string | null
  taxRate: string
  transactionType: TransactionType
  buyerLegalName: string | null
  buyerTin: string | null
  buyerVatNumber: string | null
  buyerIdType: string | null
  buyerIdNumber: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  buyerCity: string | null
  buyerRegion: string | null
  buyerCountry: string | null
  buyerZone: string | null
  buyerKebele: string | null
  buyerWereda: string | null
  buyerHouseNumber: string | null
  paymentMode: string
  paymentTerm: string
  incomeWithholdRate: string | null
  cashierName: string
  salesPersonName: string
  subtotal: string
  taxAmount: string
  grandTotal: string
  irn: string | null
  registrationStatus: string | null
  registrationError: {
    statusCode: number | null
    message: string
    issues: { portion: string; messages: string[] }[]
  } | null
  receipt: {
    status: string | null
    eimsStatus: string | null
    error: string | null
    number: string | null
    rrn: string | null
  } | null
  createdAt: string
  user: { id: string; name: string; email: string }
  lines: {
    id: string
    lineNumber: number
    description: string
    quantity: string
    unitPrice: string
    total: string
    itemCode: string | null
    unit: string
  }[]
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={value}
        readOnly
        className="cursor-default bg-muted/40"
      />
    </div>
  )
}

function FailurePanel({
  title,
  message,
  statusCode,
  issues,
  badge,
}: {
  title: string
  message: string
  statusCode?: number | null
  issues?: { portion: string; messages: string[] }[]
  badge?: string | null
}) {
  const [copied, setCopied] = useState(false)

  const text = [
    title,
    statusCode !== undefined && statusCode !== null ? `EIMS ${statusCode}` : "",
    badge ?? "",
    message,
    ...(issues ?? []).map(
      (issue) =>
        `${issue.portion ? `${issue.portion}: ` : ""}${issue.messages.join("; ")}`
    ),
  ]
    .filter(Boolean)
    .join("\n")

  const handleCopy = async () => {
    try {
      await copyText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable; ignore
    }
  }

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        {title}
        {statusCode !== undefined && statusCode !== null && (
          <Badge variant="destructive">EIMS {statusCode}</Badge>
        )}
        {badge && <Badge variant="outline">{badge}</Badge>}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="ml-auto"
          onClick={handleCopy}
        >
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {issues && issues.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex gap-2">
                {issue.portion && (
                  <span className="shrink-0 font-medium text-muted-foreground">
                    {issue.portion}:
                  </span>
                )}
                <span>{issue.messages.join("; ")}</span>
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}

export default function AdminInvoiceViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [invoice, setInvoice] = useState<AdminInvoiceView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { id } = await params
      try {
        const res = await fetch(`/api/admin/invoices/${id}`)
        if (!res.ok) {
          throw new Error("Failed to load invoice")
        }
        const body = (await res.json()) as { invoice: AdminInvoiceView }
        if (!cancelled) setInvoice(body.invoice)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load invoice")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params])

  return (
        <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Invoice {invoice?.number ?? "…"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Viewing a saved invoice.
          </p>
        </div>
        {invoice?.registrationStatus && (
          <StatusBadge status={invoice.registrationStatus} />
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && !invoice && (
    <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {invoice && (
        <>
          {invoice.registrationStatus === "FAILED" && (
            <FailurePanel
              title="Registration failed"
              statusCode={invoice.registrationError?.statusCode ?? null}
              message={
                invoice.registrationError?.message ||
                (invoice.registrationError?.issues?.length
                  ? "EIMS rejected the invoice registration."
                  : "EIMS rejected the invoice registration. No error details were stored.")
              }
              issues={invoice.registrationError?.issues ?? []}
            />
          )}
          {invoice.receipt?.status === "FAILED" && (
            <FailurePanel
              title="Receipt failed"
              message={
                invoice.receipt.error ||
                "EIMS rejected the receipt. No error details were stored."
              }
              badge={invoice.receipt.eimsStatus}
            />
          )}
        </>
      )}

      {invoice && (
        <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1">
              <Field label="Date" value={invoice.date} />
            </div>
            <div className="flex-1">
              <Field label="Transaction Type" value={invoice.transactionType} />
            </div>
          </div>

          <Collapsible defaultOpen className="group rounded-lg border">
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium select-none">
              {invoice.transactionType === "B2B" ? (
                <Building2 className="size-4" />
              ) : (
                <User className="size-4" />
              )}
              Buyer Details
              <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-data-[open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-4 border-t p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Legal Name"
                  value={invoice.buyerLegalName ?? "—"}
                />
                <Field label="TIN" value={invoice.buyerTin ?? "—"} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="VAT Number"
                  value={invoice.buyerVatNumber ?? "—"}
                />
                <Field
                  label="ID Number"
                  value={invoice.buyerIdNumber ?? "—"}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="ID Type" value={invoice.buyerIdType ?? "—"} />
                <Field label="Email" value={invoice.buyerEmail ?? "—"} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Phone" value={invoice.buyerPhone ?? "—"} />
                <Field
                  label="House Number"
                  value={invoice.buyerHouseNumber ?? "—"}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Region" value={invoice.buyerRegion ?? "—"} />
                <Field label="City" value={invoice.buyerCity ?? "—"} />
                <Field label="Country" value={invoice.buyerCountry ?? "—"} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Zone" value={invoice.buyerZone ?? "—"} />
                <Field label="Wereda" value={invoice.buyerWereda ?? "—"} />
                <Field label="Kebele" value={invoice.buyerKebele ?? "—"} />
              </div>
            </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Field label="Cashier Name" value={invoice.cashierName} />
            <Field label="Sales Person" value={invoice.salesPersonName} />
            <Field
              label="Income Withhold (%)"
              value={
                invoice.incomeWithholdRate
                  ? String(invoice.incomeWithholdRate)
                  : "—"
              }
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20 text-right">Qty</TableHead>
                  <TableHead className="w-24 text-right">Unit</TableHead>
                  <TableHead className="w-28 text-right">
                    Unit Price
                  </TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.itemCode ?? "—"}</TableCell>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {unitLabel(line.unit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(moneyToCents(line.unitPrice))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(moneyToCents(line.total))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="ml-auto flex w-64 flex-col gap-1.5 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatCents(moneyToCents(invoice.subtotal))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>
                Tax ({taxCodeLabel(invoice.taxCode)}{" "}
                {Math.round(Number(invoice.taxRate) * 100)}%)
              </span>
              <span className="tabular-nums">
                {formatCents(moneyToCents(invoice.taxAmount))}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Grand Total</span>
              <span className="tabular-nums">
                {formatCents(moneyToCents(invoice.grandTotal))}
              </span>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-muted-foreground">
              <span>
                Owned by{" "}
                <span className="font-medium text-foreground">
                  {invoice.user.name || invoice.user.email}
                </span>
              </span>
              <span>Payment mode: {invoice.paymentMode}</span>
              <span>Payment term: {invoice.paymentTerm}</span>
              {invoice.irn && <span>IRN: {invoice.irn}</span>}
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
