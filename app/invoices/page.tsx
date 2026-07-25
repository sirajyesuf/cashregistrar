"use client"

import { useState } from "react"
import { InvoiceForm } from "@/components/invoice/invoice-form"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import type { InvoiceData } from "@/lib/invoice"

export default function InvoicesPage() {
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)

  if (invoiceData) {
    return (
      <div className="p-6">
        <InvoicePreview data={invoiceData} onBack={() => setInvoiceData(null)} />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-8 text-2xl font-bold">New Invoice</h1>
      <InvoiceForm onSubmit={setInvoiceData} />
    </div>
  )
}
