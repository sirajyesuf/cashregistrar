"use client"

import { useEffect } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { InvoiceData } from "@/lib/invoice"
import { calculateTotals, formatCurrency } from "@/lib/invoice"

type Props = {
  data: InvoiceData
  onBack: () => void
}

export function InvoicePreview({ data, onBack }: Props) {
  const { subtotal, taxAmount, grandTotal } = calculateTotals(
    data.lineItems,
    data.taxRate
  )

  useEffect(() => {
    const original = document.title
    document.title = `Invoice ${data.invoiceNumber}`
    return () => {
      document.title = original
    }
  }, [data.invoiceNumber])

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex gap-3 print:hidden">
        <Button variant="outline" onClick={onBack}>
          &larr; Edit
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>

      <div className="rounded-lg border bg-white p-8 shadow-sm print:border-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
            <p className="mt-1 text-sm text-gray-500">{data.invoiceNumber}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="font-medium">Your Business Name</p>
            <p>123 Business Street</p>
            <p>City, Country</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-medium tracking-wider text-gray-500 uppercase">
              Bill To
            </p>
            <p className="mt-1 font-medium text-gray-900">
              {data.customerName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium tracking-wider text-gray-500 uppercase">
              Date
            </p>
            <p className="mt-1 text-gray-900">{data.date}</p>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="pb-2 text-left font-medium text-gray-500">
                Description
              </th>
              <th className="pb-2 text-right font-medium text-gray-500">Qty</th>
              <th className="pb-2 text-right font-medium text-gray-500">
                Rate
              </th>
              <th className="pb-2 text-right font-medium text-gray-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-3 text-gray-900">{item.description}</td>
                <td className="py-3 text-right text-gray-900 tabular-nums">
                  {item.quantity}
                </td>
                <td className="py-3 text-right text-gray-900 tabular-nums">
                  {formatCurrency(item.rate)}
                </td>
                <td className="py-3 text-right text-gray-900 tabular-nums">
                  {formatCurrency(item.quantity * item.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax ({data.taxRate}%)</span>
            <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base font-bold text-gray-900">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-gray-400">
          Thank you for your business!
        </div>
      </div>

      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  )
}
