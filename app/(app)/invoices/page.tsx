"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/ui/pagination"
import { RegisterButton } from "@/components/invoice/register-button"
import { formatCents, moneyToCents } from "@/lib/invoice"

type InvoiceRow = {
  id: string
  number: string
  date: string
  buyerLegalName: string | null
  grandTotal: string
  _count: { lines: number }
  irn?: string | null
  registrationStatus?: string | null
}

const PAGE_SIZE = 10

function StatusBadge({
  status,
  irn,
}: {
  status?: string | null
  irn?: string | null
}) {
  if (status === "REGISTERED") {
    return (
      <Badge variant="success" title={irn ? `IRN: ${irn}` : undefined}>
        Registered
      </Badge>
    )
  }
  if (status === "FAILED") {
    return <Badge variant="destructive">Failed</Badge>
  }
  return <Badge variant="outline">Unregistered</Badge>
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/invoices?page=${page}&pageSize=${PAGE_SIZE}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load invoices")
        const body = (await res.json()) as {
          invoices: InvoiceRow[]
          total: number
        }
        if (cancelled) return
        setError(null)
        setInvoices(body.invoices)
        setTotal(body.total)
      })
      .catch((err) => {
        if (cancelled) return
        setInvoices(null)
        setError(
          err instanceof Error ? err.message : "Failed to load invoices"
        )
      })
    return () => {
      cancelled = true
    }
  }, [page, reloadKey])

  const handleRegistered = (id: string) => {
    setInvoices((prev) =>
      prev?.map((invoice) =>
        invoice.id === id
          ? { ...invoice, registrationStatus: "REGISTERED" }
          : invoice
      ) ?? prev
    )
  }

  const handleDelete = async (invoice: InvoiceRow) => {
    if (!window.confirm(`Delete invoice ${invoice.number}? This cannot be undone.`)) {
      return
    }
    setDeletingId(invoice.id)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Failed to delete invoice (${res.status})`)
      if (invoices && invoices.length === 1 && page > 1) {
        setPage((prev) => prev - 1)
      } else {
        setReloadKey((key) => key + 1)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete invoice"
      )
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex flex-wrap gap-2">
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
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Number</th>
                  <th className="px-4 py-2 text-left font-medium">Customer</th>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Lines</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
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
                    <td className="px-4 py-2">
                      {invoice.buyerLegalName || "—"}
                    </td>
                    <td className="px-4 py-2">{invoice.date.slice(0, 10)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {invoice._count.lines}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCents(moneyToCents(invoice.grandTotal))}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        status={invoice.registrationStatus}
                        irn={invoice.irn}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <RegisterButton
                          invoiceId={invoice.id}
                          size="sm"
                          disabled={invoice.registrationStatus === "REGISTERED"}
                          onRegistered={() => handleRegistered(invoice.id)}
                        />
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
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
