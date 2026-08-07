"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { Button } from "@/components/ui/button"
import type { PreviewInvoice, SellerInfo } from "@/lib/invoice"
import { formatCents } from "@/lib/invoice"

type Props = {
  data: PreviewInvoice
  seller: SellerInfo
}

export function InvoicePreview({ data, seller }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const promiseResolveRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const original = document.title
    document.title = `Invoice ${data.number}`
    return () => {
      document.title = original
    }
  }, [data.number])

  useEffect(() => {
    if (!isPrinting || !promiseResolveRef.current) return
    promiseResolveRef.current()
  }, [isPrinting])

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Invoice-${data.number}`,
    onBeforePrint: () =>
      new Promise<void>((resolve) => {
        promiseResolveRef.current = resolve
        setIsPrinting(true)
      }),
    onAfterPrint: () => {
      promiseResolveRef.current = null
      setIsPrinting(false)
    },
    pageStyle: `@page { size: A4; margin: 1.5cm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } table tr { break-inside: avoid; } .invoice-totals { break-inside: avoid; } }`,
  })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex justify-end gap-3 print:hidden">
        <Button onClick={() => handlePrint()} disabled={isPrinting}>
          {isPrinting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Printer className="mr-2 h-4 w-4" />
          )}
          {isPrinting ? "Preparing…" : "Print / Save PDF"}
        </Button>
      </div>

      <div
        ref={contentRef}
        className="rounded-lg border bg-white p-5 shadow-sm sm:p-8 print:border-none print:shadow-none"
      >
        <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
            <p className="mt-1 text-sm text-gray-500">{data.number}</p>
          </div>
          <div className="text-sm text-gray-600 sm:text-right">
            <p className="font-medium">{seller.businessName || "—"}</p>
            <p>{seller.street}</p>
            <p>
              {seller.city}
              {seller.city && seller.country ? ", " : ""}
              {seller.country}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-8">
          <div>
            <p className="text-xs font-medium tracking-wider text-gray-500 uppercase">
              Bill To
            </p>
            <p className="mt-1 font-medium break-words text-gray-900">
              {data.buyer?.legalName || "—"}
            </p>
            {data.buyer?.tin && (
              <p className="text-sm text-gray-600">TIN: {data.buyer.tin}</p>
            )}
            {data.buyer?.phone && (
              <p className="text-sm text-gray-600">{data.buyer.phone}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium tracking-wider text-gray-500 uppercase">
              Date
            </p>
            <p className="mt-1 text-gray-900">{data.date}</p>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500">
                  Description
                </th>
                <th className="pb-2 text-right font-medium text-gray-500">
                  Qty
                </th>
                <th className="pb-2 text-right font-medium text-gray-500">
                  Unit Price
                </th>
                <th className="pb-2 text-right font-medium text-gray-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-3 text-gray-900">
                    {item.itemCode ? (
                      <>
                        <span className="font-medium">{item.itemCode}</span>{" "}
                        <span className="text-gray-500">· </span>
                      </>
                    ) : null}
                    {item.description}
                  </td>
                  <td className="py-3 text-right text-gray-900 tabular-nums">
                    {item.quantity} {item.unit || ""}
                  </td>
                  <td className="py-3 text-right text-gray-900 tabular-nums">
                    {formatCents(item.unitPriceCents)}
                  </td>
                  <td className="py-3 text-right text-gray-900 tabular-nums">
                    {formatCents(item.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="invoice-totals mt-4 ml-auto w-full max-w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {formatCents(data.subtotalCents)}
            </span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax ({data.taxRate}%)</span>
            <span className="tabular-nums">
              {formatCents(data.taxAmountCents)}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base font-bold text-gray-900">
            <span>Total</span>
            <span className="tabular-nums">
              {formatCents(data.grandTotalCents)}
            </span>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-gray-400">
          Thank you for your business!
        </div>
      </div>
    </div>
  )
}
