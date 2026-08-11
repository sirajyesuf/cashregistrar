"use client"

import { useState } from "react"
import Image from "next/image"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Pencil, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import { RegisterButton } from "@/components/invoice/register-button"
import { CancelButton } from "@/components/invoice/cancel-button"
import { ReceiptButton } from "@/components/invoice/receipt-button"
import { HashField } from "@/components/invoice/hash-field"
import { formatCents, hasIssuedReceipt, invoiceFromApi } from "@/lib/invoice"

type ApiInvoice = {
  id: string
  number: string
  date: string
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

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-end print:hidden">
        <Link href={`/invoices/${id}/edit`}>
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      {!errorMessage && notFound && (
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
      )}

      {!errorMessage && !notFound && isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {invoice && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 print:hidden">
            <button
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              className="flex w-full items-center gap-3 p-4 text-left"
              aria-expanded={panelOpen}
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  panelOpen ? "" : "-rotate-90"
                }`}
              />
              <span className="text-sm font-semibold">EIMS Registration</span>
              {invoice.registrationStatus === "REGISTERED" ? (
                <Badge variant="success">Registered</Badge>
              ) : invoice.registrationStatus === "PROCESSING" ? (
                <Badge variant="outline">Processing</Badge>
              ) : invoice.registrationStatus === "CANCELLED" ? (
                <Badge variant="outline">Cancelled</Badge>
              ) : invoice.registrationStatus === "FAILED" ? (
                <Badge variant="destructive">Failed</Badge>
              ) : (
                <Badge variant="outline">Unregistered</Badge>
              )}
              {receiptIssued && <Badge variant="outline">Receipt issued</Badge>}
            </button>

            {panelOpen && (
              <div className="space-y-3 border-t p-4">
                {invoice.irn && (
                  <HashField label="Invoice IRN" value={invoice.irn} />
                )}

                {receiptIssued && (
                  <div className="space-y-2">
                    {invoice.receipt?.qr && (
                      <div className="flex flex-col items-center gap-2 py-1">
                        <div className="rounded-lg bg-white p-4">
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

                <div className="flex flex-wrap items-center gap-2">
                  <RegisterButton
                    invoiceId={invoice.id}
                    size="sm"
                    disabled={cannotRegister}
                  />
                  {invoice.registrationStatus === "REGISTERED" &&
                    !receiptIssued && (
                      <CancelButton
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.number}
                        size="sm"
                      />
                    )}
                  {invoice.registrationStatus === "REGISTERED" &&
                    !receiptIssued && (
                      <ReceiptButton
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.number}
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
            )}
          </div>

          <InvoicePreview data={invoice} seller={invoice.seller} />
        </div>
      )}
    </div>
  )
}
