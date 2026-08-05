"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import { RegisterButton } from "@/components/invoice/register-button"
import { CancelButton } from "@/components/invoice/cancel-button"
import { invoiceFromApi } from "@/lib/invoice"
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

  const cannotRegister = invoice?.registrationStatus === "REGISTERED"

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
            </div>
          </div>
          <InvoicePreview data={invoice} seller={seller} />
        </div>
      )}
    </div>
  )
}
