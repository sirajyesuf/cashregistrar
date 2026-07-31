"use client"

import { useState, useCallback } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { LineItem, InvoiceData } from "@/lib/invoice"
import {
  calculateTotals,
  formatCurrency,
  generateInvoiceNumber,
  todayString,
} from "@/lib/invoice"

function createLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0 }
}

type Props = {
  onSubmit: (data: InvoiceData) => void
}

export function InvoiceForm({ onSubmit }: Props) {
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber)
  const [date, setDate] = useState(todayString())
  const [customerName, setCustomerName] = useState("")
  const [lineItems, setLineItems] = useState<LineItem[]>([createLineItem()])
  const [taxRate, setTaxRate] = useState(10)

  const updateLineItem = useCallback(
    (id: string, field: keyof Omit<LineItem, "id">, value: string | number) => {
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        )
      )
    },
    []
  )

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, createLineItem()])
  }, [])

  const { subtotal, taxAmount, grandTotal } = calculateTotals(
    lineItems,
    taxRate
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ invoiceNumber, date, customerName, lineItems, taxRate })
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label htmlFor="invoiceNumber" className="text-sm font-medium">
            Invoice #
          </label>
          <Input
            id="invoiceNumber"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            required
          />
        </div>
        <div className="flex-1">
          <label htmlFor="date" className="text-sm font-medium">
            Date
          </label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="customerName" className="text-sm font-medium">
          Customer Name
        </label>
        <Input
          id="customerName"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="e.g. Acme Corp"
          required
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Line Items</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLineItem}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Item
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Rate</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-1.5">
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(item.id, "description", e.target.value)
                      }
                      className="w-full bg-transparent px-1 py-1 outline-none"
                      placeholder="Item description"
                      required
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(
                          item.id,
                          "quantity",
                          Number(e.target.value)
                        )
                      }
                      className="w-full bg-transparent px-1 py-1 text-right outline-none"
                      required
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) =>
                        updateLineItem(item.id, "rate", Number(e.target.value))
                      }
                      className="w-full bg-transparent px-1 py-1 text-right outline-none"
                      required
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatCurrency(item.quantity * item.rate)}
                  </td>
                  <td className="px-2 py-1.5">
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1" />
        <div className="w-48">
          <label htmlFor="taxRate" className="text-sm font-medium">
            Tax Rate (%)
          </label>
          <Input
            id="taxRate"
            type="number"
            min="0"
            max="100"
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="ml-auto w-64 space-y-1.5 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax ({taxRate}%)</span>
          <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Grand Total</span>
          <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Generate Invoice
        </Button>
      </div>
    </form>
  )
}
