"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import { invoiceFromApi } from "@/lib/invoice"
import type { PreviewInvoice, SellerInfo } from "@/lib/invoice"

type ApiInvoice = {
  id: string
  number: string
  date: string
  customerName: string
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
    Promise.all([
      fetch(`/api/invoices/${id}`),
      fetch("/api/settings/seller"),
    ])
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

      {invoice && <InvoicePreview data={invoice} seller={seller} />}
    </div>
  )
}
