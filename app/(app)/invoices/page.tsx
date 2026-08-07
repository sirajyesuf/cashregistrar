"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { RegisterButton } from "@/components/invoice/register-button"
import { CancelButton } from "@/components/invoice/cancel-button"
import { formatCents, hasIssuedReceipt, moneyToCents } from "@/lib/invoice"

type InvoiceRow = {
  id: string
  number: string
  date: string
  buyerLegalName: string | null
  grandTotal: string
  _count: { lines: number }
  irn?: string | null
  registrationStatus?: string | null
  receipt?: { status?: string | null } | null
}

const PAGE_SIZE = 10

function cannotEdit(invoice: InvoiceRow): boolean {
  return invoice.registrationStatus === "REGISTERED"
}

function cannotDelete(invoice: InvoiceRow): boolean {
  return (
    invoice.registrationStatus === "REGISTERED" || hasIssuedReceipt(invoice)
  )
}

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
  if (status === "CANCELLED") {
    return <Badge variant="outline">Cancelled</Badge>
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
  const [selected, setSelected] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
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
        setError(err instanceof Error ? err.message : "Failed to load invoices")
      })
    return () => {
      cancelled = true
    }
  }, [page, reloadKey])

  const handleRegistered = (id: string) => {
    setInvoices(
      (prev) =>
        prev?.map((invoice) =>
          invoice.id === id
            ? { ...invoice, registrationStatus: "REGISTERED" }
            : invoice
        ) ?? prev
    )
  }

  const handleCancelled = (id: string) => {
    setInvoices(
      (prev) =>
        prev?.map((invoice) =>
          invoice.id === id
            ? { ...invoice, registrationStatus: "CANCELLED" }
            : invoice
        ) ?? prev
    )
  }

  const handleDelete = async (invoice: InvoiceRow) => {
    if (
      !window.confirm(
        `Delete invoice ${invoice.number}? This cannot be undone.`
      )
    ) {
      return
    }
    setDeletingId(invoice.id)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error(`Failed to delete invoice (${res.status})`)
      if (invoices && invoices.length === 1 && page > 1) {
        setPage((prev) => prev - 1)
      } else {
        setReloadKey((key) => key + 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete invoice")
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const selectableIds = (invoices ?? []).filter((inv) => !cannotDelete(inv)).map((inv) => inv.id)
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id))
  const someSelected = selected.some((id) => selectableIds.includes(id))

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleBulkDelete = async () => {
    const ids = selected.filter((id) => {
      const inv = invoices?.find((i) => i.id === id)
      return inv ? !cannotDelete(inv) : false
    })
    if (ids.length === 0) return
    if (
      !window.confirm(
        `Delete ${ids.length} selected invoice${ids.length > 1 ? "s" : ""}? This cannot be undone.`
      )
    ) {
      return
    }
    setBulkDeleting(true)
    setError(null)
    try {
      const res = await fetch("/api/invoices/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        deleted?: number
        skipped?: number
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to delete invoices (${res.status})`)
      }
      setSelected([])
      if (invoices && invoices.length === ids.length && page > 1) {
        setPage((prev) => prev - 1)
      } else {
        setReloadKey((key) => key + 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete invoices")
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex flex-wrap gap-2">
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
          {selected.length > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
              <span className="text-sm font-medium">
                {selected.length} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {bulkDeleting ? "Deleting…" : "Delete selected"}
              </Button>
            </div>
          )}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onCheckedChange={(checked) => {
                        setSelected(checked ? selectableIds : [])
                      }}
                      aria-label="Select all invoices"
                    />
                  </TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(invoice.id)}
                        disabled={cannotDelete(invoice)}
                        onCheckedChange={() => toggleSelect(invoice.id)}
                        aria-label={`Select ${invoice.number}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {invoice.number}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.buyerLegalName || "—"}</TableCell>
                    <TableCell>{invoice.date.slice(0, 10)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {invoice._count.lines}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(moneyToCents(invoice.grandTotal))}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge
                          status={invoice.registrationStatus}
                          irn={invoice.irn}
                        />
                        {hasIssuedReceipt(invoice) && (
                          <Badge variant="outline">Receipt issued</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <RegisterButton
                          invoiceId={invoice.id}
                          size="sm"
                          disabled={invoice.registrationStatus === "REGISTERED"}
                          onRegistered={() => handleRegistered(invoice.id)}
                        />
                        {invoice.registrationStatus === "REGISTERED" &&
                          !hasIssuedReceipt(invoice) && (
                            <CancelButton
                              invoiceId={invoice.id}
                              invoiceNumber={invoice.number}
                              size="sm"
                              onCancelled={() => handleCancelled(invoice.id)}
                            />
                          )}
                        <Link
                          href={`/invoices/${invoice.id}/edit`}
                          aria-disabled={cannotEdit(invoice)}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cannotEdit(invoice)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </Link>
                        <Link href={`/invoices/${invoice.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(invoice)}
                          disabled={deletingId === invoice.id || cannotDelete(invoice)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingId === invoice.id ? "Deleting…" : "Delete"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
