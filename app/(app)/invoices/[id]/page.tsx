"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Pencil, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import { RegisterButton } from "@/components/invoice/register-button"
import { CancelButton } from "@/components/invoice/cancel-button"
import { ReceiptButton } from "@/components/invoice/receipt-button"
import { HashField } from "@/components/invoice/hash-field"
import { formatCents, hasIssuedReceipt, invoiceFromApi } from "@/lib/invoice"
import type { PreviewInvoice, SellerInfo } from "@/lib/invoice"

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
}

const DEFAULT_SELLER: SellerInfo = {
  businessName: "",
  street: "",
  city: "",
  country: "",
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<PreviewInvoice | null>(null)
  const [seller, setSeller] = useState<SellerInfo>(DEFAULT_SELLER)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  useEffect(() => {
    Promise.all([fetch(`/api/invoices/${id}`), fetch("/api/settings/seller")])
      .then(async ([invoiceRes, sellerRes]) => {
        if (!invoiceRes.ok) {
          if (invoiceRes.status === 404) setNotFound(true)
          throw new Error("Failed to load invoice")
        }
        const invoiceBody = (await invoiceRes.json()) as { invoice: ApiInvoice }
        setInvoice(invoiceFromApi(invoiceBody.invoice))
        if (sellerRes.ok) {
          const sellerBody = (await sellerRes.json()) as {
            profile: SellerInfo
          }
          setSeller(sellerBody.profile)
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load invoice")
      )
  }, [id])

  const handleRegistered = (irn: string | null) => {
    setInvoice((prev) =>
      prev ? { ...prev, irn, registrationStatus: "REGISTERED" } : prev
    )
  }

  const handleCancelled = () => {
    setInvoice((prev) =>
      prev ? { ...prev, registrationStatus: "CANCELLED" } : prev
    )
  }

  const handleReceiptIssued = (receipt: {
    rrn: string | null
    qr: string | null
    status: string | null
  }) => {
    setInvoice((prev) =>
      prev
        ? {
            ...prev,
            receipt: {
              number: prev.receipt?.number ?? null,
              rrn: receipt.rrn,
              qr: receipt.qr,
              eimsStatus: receipt.status,
              status: "ISSUED",
            },
          }
        : prev
    )
  }

  const cannotRegister = invoice?.registrationStatus === "REGISTERED"
  const receiptIssued = hasIssuedReceipt(invoice)

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

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && notFound && (
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
      )}

      {!error && !notFound && !invoice && (
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
                    onRegistered={handleRegistered}
                  />
                  {invoice.registrationStatus === "REGISTERED" &&
                    !receiptIssued && (
                      <CancelButton
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.number}
                        size="sm"
                        onCancelled={handleCancelled}
                      />
                    )}
                  {invoice.registrationStatus === "REGISTERED" &&
                    !receiptIssued && (
                      <ReceiptButton
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.number}
                        size="sm"
                        onIssued={handleReceiptIssued}
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

          <InvoicePreview data={invoice} seller={seller} />
        </div>
      )}
    </div>
  )
}
