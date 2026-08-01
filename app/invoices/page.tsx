"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCents, moneyToCents } from "@/lib/invoice"

type InvoiceRow = {
  id: string
  number: string
  date: string
  customerName: string
  grandTotal: string
  _count: { lines: number }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/invoices")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load invoices")
        const body = (await res.json()) as { invoices: InvoiceRow[] }
        setInvoices(body.invoices)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load invoices")
      )
  }, [])

  const handleDelete = async (invoice: InvoiceRow) => {
    if (!window.confirm(`Delete invoice ${invoice.number}? This cannot be undone.`)) {
      return
    }
    setDeletingId(invoice.id)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Failed to delete invoice (${res.status})`)
      setInvoices((prev) => prev?.filter((item) => item.id !== invoice.id) ?? null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete invoice"
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex gap-2">
          <Link href="/settings">
            <Button variant="outline">Business Settings</Button>
          </Link>
          <Link href="/invoices/new">
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {!error && invoices === null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {invoices && invoices.length === 0 && (
        <div className="rounded-lg border p-10 text-center">
          <p className="text-muted-foreground">No invoices yet.</p>
          <Link href="/invoices/new" className="mt-4 inline-block">
            <Button>Create your first invoice</Button>
          </Link>
        </div>
      )}

      {invoices && invoices.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Number</th>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Lines</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t">
                  <td className="px-4 py-2">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {invoice.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{invoice.customerName}</td>
                  <td className="px-4 py-2">{invoice.date.slice(0, 10)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {invoice._count.lines}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCents(moneyToCents(invoice.grandTotal))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/invoices/${invoice.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(invoice)}
                        disabled={deletingId === invoice.id}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === invoice.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
