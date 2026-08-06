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
      <div className="mb-6 flex items-center justify-between">
        <Link href="/invoices">
          <Button variant="outline">&larr; Back to Invoices</Button>
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3 print:hidden">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">EIMS Registration</span>
              {invoice.registrationStatus === "REGISTERED" ? (
                <Badge variant="success">
                  {invoice.irn ? `Registered · ${invoice.irn}` : "Registered"}
                </Badge>
              ) : invoice.registrationStatus === "CANCELLED" ? (
                <Badge variant="outline">Cancelled</Badge>
              ) : invoice.registrationStatus === "FAILED" ? (
                <Badge variant="destructive">Failed</Badge>
              ) : (
                <Badge variant="outline">Unregistered</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
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
              {receiptIssued && (
                <Badge
                  variant="success"
                  title={invoice.receipt?.rrn ?? undefined}
                >
                  {invoice.receipt?.rrn
                    ? `Receipt · ${invoice.receipt.rrn}`
                    : "Receipt"}
                </Badge>
              )}
            </div>
          </div>

          {receiptIssued && (
            <div className="rounded-lg border bg-muted/30 p-4 print:hidden">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Sales Receipt</span>
                {invoice.receipt?.number && (
                  <span className="text-sm text-muted-foreground">
                    {invoice.receipt.number}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-4">
                {invoice.receipt?.qr && (
                  <Image
                    src={`data:image/png;base64,${invoice.receipt.qr}`}
                    alt="Receipt QR code"
                    width={144}
                    height={144}
                    unoptimized
                    className="size-36 rounded-md border bg-white"
                  />
                )}
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">RRN: </span>
                    {invoice.receipt?.rrn ?? "—"}
                  </p>
                  {invoice.receipt?.eimsStatus && (
                    <p>
                      <span className="text-muted-foreground">Status: </span>
                      {invoice.receipt.eimsStatus}
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">Amount: </span>
                    {formatCents(invoice.grandTotalCents)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <InvoicePreview data={invoice} seller={seller} />
        </div>
      )}
    </div>
  )
}
