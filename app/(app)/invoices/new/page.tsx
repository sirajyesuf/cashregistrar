import Link from "next/link"
import { Button } from "@/components/ui/button"
import { InvoiceForm } from "@/components/invoice/invoice-form"

export default function NewInvoicePage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Invoice</h1>
        <Link href="/invoices">
          <Button variant="outline">Back to Invoices</Button>
        </Link>
      </div>
      <InvoiceForm />
    </div>
  )
}
