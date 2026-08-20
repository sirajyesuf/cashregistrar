"use client"

import { useState } from "react"
import Image from "next/image"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Pencil, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import { RegisterButton } from "@/components/invoice/register-button"
import { CancelButton } from "@/components/invoice/cancel-button"
import { ReceiptButton } from "@/components/invoice/receipt-button"
import { WithholdingReceiptButton } from "@/components/invoice/withholding-receipt-button"
import { HashField } from "@/components/invoice/hash-field"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  formatCents,
  hasIssuedReceipt,
  hasIssuedWithholdingReceipt,
  invoiceFromApi,
} from "@/lib/invoice"
import { cancellationReasonLabel } from "@/lib/einvoice/cancellation-reason"

type ApiInvoice = {
  id: string
  number: string
  businessId: string
  date: string
  taxCode?: string | null
  taxRate: string
  subtotal: string
  taxAmount: string
  grandTotal: string
  lines: {
    id: string
    description: string
    quantity: string
    unitPrice: string
    total: string
  }[]
  sellerCity?: string | null
  sellerCountry?: string | null
  sellerEmail?: string | null
  sellerHouseNumber?: string | null
  sellerLegalName?: string | null
  sellerLocality?: string | null
  sellerPhone?: string | null
  sellerRegion?: string | null
  sellerSubCity?: string | null
  sellerTin?: string | null
  sellerVatNumber?: string | null
  sellerWereda?: string | null
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [panelOpen, setPanelOpen] = useState(true)

  const {
    data: invoice,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}`)
      if (res.status === 404) throw new Error("NOT_FOUND")
      if (!res.ok) throw new Error("Failed to load invoice")
      const body = (await res.json()) as { invoice: ApiInvoice }
      return invoiceFromApi(body.invoice)
    },
    refetchInterval: (query) =>
      (query.state.data as { registrationStatus?: string | null } | undefined)
        ?.registrationStatus === "PROCESSING"
        ? 5000
        : false,
  })

  const notFound = error?.message === "NOT_FOUND"
  const errorMessage =
    error && error.message !== "NOT_FOUND" ? error.message : null

  const cannotRegister =
    invoice?.registrationStatus === "REGISTERED" ||
    invoice?.registrationStatus === "PROCESSING"
  const receiptIssued = hasIssuedReceipt(invoice ?? null)
  const withholdingIssued = hasIssuedWithholdingReceipt(invoice ?? null)

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-end print:hidden">
        <Link href={`/invoices/${id}/edit`}>
          <Button variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        </Link>
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      {!errorMessage && notFound && (
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
      )}

      {!errorMessage && !notFound && isLoading && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="mt-4 h-8 w-full" />
          </div>
          <div className="rounded-lg border bg-white p-5 sm:p-8">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
            <Skeleton className="mt-6 h-24 w-64 self-end" />
          </div>
        </div>
      )}

      {invoice && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/30 print:hidden">
            <Collapsible
              open={panelOpen}
              onOpenChange={setPanelOpen}
              className="group"
            >
              <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left outline-none">
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-data-[open]:rotate-0"
                  )}
                />
                <span className="text-sm font-semibold">EIMS Registration</span>
                {invoice.registrationStatus === "REGISTERED" ? (
                  <Badge variant="outline" className="text-success">Registered</Badge>
                ) : invoice.registrationStatus === "PROCESSING" ? (
                  <Badge variant="outline">Processing</Badge>
                ) : invoice.registrationStatus === "CANCELLED" ? (
                  <Badge variant="outline">Cancelled</Badge>
                ) : invoice.registrationStatus === "FAILED" ? (
                  <Badge variant="destructive">Failed</Badge>
                ) : (
                  <Badge variant="outline">Unregistered</Badge>
                )}
                {receiptIssued && (
                  <Badge variant="outline">Receipt issued</Badge>
                )}
                {withholdingIssued && (
                  <Badge variant="outline">Withholding issued</Badge>
                )}
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="flex flex-col gap-3 border-t p-4">
                  {invoice.irn && (
                    <HashField label="Invoice IRN" value={invoice.irn} />
                  )}

                  {invoice.registrationStatus === "CANCELLED" && (
                    <div className="flex flex-col gap-2">
                      {invoice.cancellationReason && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">
                            Cancellation reason
                          </span>
                          <span className="text-sm font-medium">
                            {cancellationReasonLabel(
                              invoice.cancellationReason
                            )}
                          </span>
                        </div>
                      )}
                      {invoice.cancellationRemark && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm text-muted-foreground">
                            Remark
                          </span>
                          <span className="text-right text-sm font-medium">
                            {invoice.cancellationRemark}
                          </span>
                        </div>
                      )}
                      {invoice.cancelledAt && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">
                            Cancelled at
                          </span>
                          <span className="text-sm font-medium">
                            {new Date(invoice.cancelledAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {invoice.cancellationError && (
                    <p className="text-sm text-destructive">
                      {invoice.cancellationError.message ??
                        "EIMS rejected the cancellation."}
                    </p>
                  )}

                  {receiptIssued && (
                    <div className="flex flex-col gap-2">
                      {invoice.receipt?.qr && (
                        <div className="flex flex-col items-center gap-2 py-1">
                          <div className="rounded-lg bg-background p-4">
                            <Image
                              src={`data:image/png;base64,${invoice.receipt.qr}`}
                              alt="Receipt QR code"
                              width={600}
                              height={600}
                              unoptimized
                              className="size-64"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Scan with the EIMS verification app to confirm the
                            receipt.
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                          Receipt
                        </span>
                        <span className="text-sm font-medium">
                          {invoice.receipt?.number ?? "—"}
                        </span>
                      </div>
                      {invoice.receipt?.rrn && (
                        <HashField
                          label="Receipt RRN"
                          value={invoice.receipt.rrn}
                        />
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                          Status
                        </span>
                        <span className="text-sm font-medium">
                          {invoice.receipt?.eimsStatus ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                          Amount
                        </span>
                        <span className="text-sm font-medium">
                          {formatCents(invoice.grandTotalCents)}
                        </span>
                      </div>
                    </div>
                  )}

                  {withholdingIssued && (
                    <div className="flex flex-col gap-2">
                      {invoice.withholdingReceipt?.qr && (
                        <div className="flex flex-col items-center gap-2 py-1">
                          <div className="rounded-lg bg-background p-4">
                            <Image
                              src={`data:image/png;base64,${invoice.withholdingReceipt.qr}`}
                              alt="Withholding receipt QR code"
                              width={600}
                              height={600}
                              unoptimized
                              className="size-64"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Scan with the EIMS verification app to confirm the
                            withholding receipt.
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                          Withholding receipt
                        </span>
                        <span className="text-sm font-medium">
                          {invoice.withholdingReceipt?.number ?? "—"}
                        </span>
                      </div>
                      {invoice.withholdingReceipt?.rrn && (
                        <HashField
                          label="Withholding RRN"
                          value={invoice.withholdingReceipt.rrn}
                        />
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                          Status
                        </span>
                        <span className="text-sm font-medium">
                          {invoice.withholdingReceipt?.eimsStatus ?? "—"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <RegisterButton
                      invoiceId={invoice.id}
                      businessId={invoice.businessId}
                      size="sm"
                      disabled={cannotRegister}
                    />
                    {invoice.registrationStatus === "REGISTERED" &&
                      !receiptIssued && (
                        <CancelButton
                          invoiceId={invoice.id}
                          invoiceNumber={invoice.number}
                          businessId={invoice.businessId}
                          size="sm"
                        />
                      )}
                    {invoice.registrationStatus === "REGISTERED" &&
                      !receiptIssued && (
                        <ReceiptButton
                          invoiceId={invoice.id}
                          invoiceNumber={invoice.number}
                          businessId={invoice.businessId}
                          size="sm"
                        />
                      )}
                    {invoice.registrationStatus === "REGISTERED" &&
                      invoice.transactionType === "B2B" &&
                      !withholdingIssued && (
                        <WithholdingReceiptButton
                          invoiceId={invoice.id}
                          invoiceNumber={invoice.number}
                          businessId={invoice.businessId}
                          size="sm"
                        />
                      )}
                  </div>
                  {receiptIssued && (
                    <p className="text-xs text-muted-foreground">
                      Cancellation isn&apos;t available once a sales receipt has
                      been issued.
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <InvoicePreview data={invoice} seller={invoice.seller} />
        </div>
      )}
    </div>
  )
}
