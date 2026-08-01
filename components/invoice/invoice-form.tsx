"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  calculateTotalsCents,
  formatCents,
  lineTotalCents,
  moneyToCents,
  todayString,
} from "@/lib/invoice"

type LineInput = {
  id: string
  description: string
  quantity: string
  unitPrice: string
}

function createLineItem(): LineInput {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "" }
}

function isFutureDate(date: string): boolean {
  return date > todayString()
}

export function InvoiceForm() {
  const router = useRouter()
  const [date, setDate] = useState(todayString())
  const [customerName, setCustomerName] = useState("")
  const [lineItems, setLineItems] = useState<LineInput[]>([createLineItem()])
  const [taxRate, setTaxRate] = useState(15)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const updateLineItem = useCallback(
    (id: string, field: keyof Omit<LineInput, "id">, value: string) => {
      setLineItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
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

  const derived = useMemo(
    () =>
      lineItems.map((item) => {
        const quantity = Number(item.quantity)
        const quantityNum =
          Number.isFinite(quantity) && quantity > 0 ? quantity : 0
        const unitPriceCents = moneyToCents(item.unitPrice)
        return {
          id: item.id,
          description: item.description,
          quantity: quantityNum,
          unitPriceCents,
          totalCents: lineTotalCents(quantityNum, unitPriceCents),
          rawQuantity: item.quantity,
          rawUnitPrice: item.unitPrice,
          valid:
            item.description.trim() !== "" &&
            quantityNum > 0 &&
            unitPriceCents >= 0,
        }
      }),
    [lineItems]
  )

  const totals = calculateTotalsCents(derived, taxRate)

  const valid = useMemo(
    () =>
      date !== "" &&
      !isFutureDate(date) &&
      customerName.trim() !== "" &&
      Number.isFinite(taxRate) &&
      taxRate >= 0 &&
      taxRate <= 100 &&
      derived.length > 0 &&
      derived.every((item) => item.valid),
    [date, customerName, taxRate, derived]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || pending) return
    setError(null)
    setPending(true)
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          customerName: customerName.trim(),
          taxRate,
          lines: derived.map((item) => ({
            description: item.description.trim(),
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
          })),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        invoice?: { id: string }
        error?: string
      }
      if (!res.ok || !body.invoice) {
        throw new Error(body.error ?? `Failed to save invoice (${res.status})`)
      }
      router.push(`/invoices/${body.invoice.id}`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save invoice"
      )
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-4">
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
          {isFutureDate(date) && (
            <p className="mt-1 text-xs text-destructive">
              Date cannot be in the future.
            </p>
          )}
        </div>
        <div className="flex-1">
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
                <th className="w-24 px-3 py-2 text-right font-medium">Qty</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Unit Price</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {derived.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-1.5">
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(item.id, "description", e.target.value)
                      }
                      aria-label="Description"
                      className="w-full bg-transparent px-1 py-1 outline-none"
                      placeholder="Item description"
                      required
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.rawQuantity}
                      onChange={(e) =>
                        updateLineItem(item.id, "quantity", e.target.value)
                      }
                      aria-label="Quantity"
                      className="w-full bg-transparent px-1 py-1 text-right outline-none"
                      required
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rawUnitPrice}
                      onChange={(e) =>
                        updateLineItem(item.id, "unitPrice", e.target.value)
                      }
                      aria-label="Unit price"
                      className="w-full bg-transparent px-1 py-1 text-right outline-none"
                      placeholder="0.00"
                      required
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatCents(item.totalCents)}
                  </td>
                  <td className="px-2 py-1.5">
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        aria-label="Remove line item"
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
            step="any"
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="ml-auto w-64 space-y-1.5 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCents(totals.subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax ({taxRate}%)</span>
          <span className="tabular-nums">{formatCents(totals.taxAmountCents)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Grand Total</span>
          <span className="tabular-nums">{formatCents(totals.grandTotalCents)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!valid || pending}>
          {pending ? "Saving…" : "Save Invoice"}
        </Button>
      </div>
    </form>
  )
}
