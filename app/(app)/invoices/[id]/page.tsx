"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import { RegisterButton } from "@/components/invoice/register-button"
import { CancelButton } from "@/components/invoice/cancel-button"
import { ReceiptButton } from "@/components/invoice/receipt-button"
import { HashField } from "@/components/invoice/hash-field"
import { formatCents, invoiceFromApi } from "@/lib/invoice"
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
  const receiptIssued = invoice?.receipt?.status === "ISSUED"

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-end print:hidden">
        <Link href={`/invoices/${id}/edit`}>
          <Button variant="outline">Edit</Button>
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
          <div className="rounded-lg border bg-muted/30 p-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
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
            </div>

            {invoice.irn && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <HashField label="Invoice IRN" value={invoice.irn} />
              </div>
            )}

            {receiptIssued && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Receipt</span>
                  <span className="text-sm font-medium">
                    {invoice.receipt?.number ?? "—"}
                  </span>
                </div>
                {invoice.receipt?.rrn && (
                  <HashField label="Receipt RRN" value={invoice.receipt.rrn} />
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm font-medium">
                    {invoice.receipt?.eimsStatus ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-sm font-medium">
                    {formatCents(invoice.grandTotalCents)}
                  </span>
                </div>
                {invoice.receipt?.qr && (
                  <div className="flex justify-center pt-2">
                    <Image
                      src={`data:image/png;base64,${invoice.receipt.qr}`}
                      alt="Receipt QR code"
                      width={128}
                      height={128}
                      unoptimized
                      className="size-32 rounded-md border bg-white"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <RegisterButton
                invoiceId={invoice.id}
                size="sm"
                disabled={cannotRegister}
                onRegistered={handleRegistered}
              />
              {invoice.registrationStatus === "REGISTERED" && (
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
          </div>

          <InvoicePreview data={invoice} seller={seller} />
        </div>
      )}
    </div>
  )
}
