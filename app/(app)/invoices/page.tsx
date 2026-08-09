"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CircleX,
  FileText,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react"
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
import { toast } from "@/components/toast"
import { useWorkspace } from "@/components/workspace-provider"
import { RegisterButton } from "@/components/invoice/register-button"
import { CancelButton } from "@/components/invoice/cancel-button"
import { BulkActions } from "@/components/invoice/bulk-actions"
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

type InvoiceStats = {
  totalInvoices: number
  failed: number
  cancelled: number
  issuedReceipts: number
}

const PAGE_SIZE = 10

function cannotEdit(invoice: InvoiceRow): boolean {
  return (
    invoice.registrationStatus === "REGISTERED" ||
    invoice.registrationStatus === "PROCESSING"
  )
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
  if (status === "PROCESSING") {
    return <Badge variant="outline">Processing</Badge>
  }
  return <Badge variant="outline">Unregistered</Badge>
}

export default function InvoicesPage() {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const businessId = workspace?.businessId ?? ""
  const branchId = workspace?.branchId ?? ""
  const workspaceKey = workspace ? `${businessId}:${branchId}` : "none"
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  const [prevWorkspaceKey, setPrevWorkspaceKey] = useState(workspaceKey)
  if (prevWorkspaceKey !== workspaceKey) {
    setPrevWorkspaceKey(workspaceKey)
    setPage(1)
    setSelected([])
  }

  const { data, error } = useQuery({
    queryKey: ["invoices", businessId, branchId, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (businessId) params.set("businessId", businessId)
      if (branchId) params.set("branchId", branchId)
      const res = await fetch(`/api/invoices?${params}`)
      if (!res.ok) throw new Error("Failed to load invoices")
      return (await res.json()) as {
        invoices: InvoiceRow[]
        total: number
        stats: InvoiceStats
      }
    },
    enabled: Boolean(workspace),
    refetchInterval: (query) =>
      (query.state.data as { invoices?: InvoiceRow[] } | undefined)?.invoices
        ?.some((invoice) => invoice.registrationStatus === "PROCESSING")
        ? 5000
        : false,
  })

  const invoices = data?.invoices ?? null
  const total = data?.total ?? 0
  const stats = data?.stats ?? null
  const errorMessage = error instanceof Error ? error.message : null

  const invalidateScoped = () => {
    queryClient.invalidateQueries({ queryKey: ["invoices", businessId] })
    queryClient.invalidateQueries({ queryKey: ["invoice"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Failed to delete invoice (${res.status})`)
    },
    onSuccess: () => {
      if (invoices && invoices.length === 1 && page > 1) {
        setPage((prev) => prev - 1)
      }
      invalidateScoped()
    },
    onError: (err) => {
      toast.add({
        title: "Could not delete invoice",
        description: err instanceof Error ? err.message : "Failed to delete",
        type: "destructive",
      })
    },
    onSettled: () => setDeletingId(null),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
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
        throw new Error(
          body.error ?? `Failed to delete invoices (${res.status})`
        )
      }
    },
    onSuccess: (_data, ids) => {
      setSelected([])
      if (invoices && invoices.length === ids.length && page > 1) {
        setPage((prev) => prev - 1)
      }
      invalidateScoped()
    },
    onError: (err) => {
      toast.add({
        title: "Could not delete invoices",
        description:
          err instanceof Error ? err.message : "Failed to delete invoices",
        type: "destructive",
      })
    },
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const selectableIds = (invoices ?? [])
    .filter(
      (inv) =>
        inv.registrationStatus !== "PROCESSING" &&
        (!cannotDelete(inv) ||
          (inv.registrationStatus === "REGISTERED" && !hasIssuedReceipt(inv)))
    )
    .map((inv) => inv.id)
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selected.includes(id))
  const someSelected = selected.some((id) => selectableIds.includes(id))

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleDelete = (invoice: InvoiceRow) => {
    if (
      !window.confirm(
        `Delete invoice ${invoice.number}? This cannot be undone.`
      )
    ) {
      return
    }
    setDeletingId(invoice.id)
    deleteMutation.mutate(invoice.id)
  }

  const handleBulkDelete = () => {
    const ids = selected.filter((id) => {
      const inv = invoices?.find((i) => i.id === id)
      return inv
        ? !cannotDelete(inv) && inv.registrationStatus !== "PROCESSING"
        : false
    })
    if (ids.length === 0) return
    if (
      !window.confirm(
        `Delete ${ids.length} selected invoice${ids.length > 1 ? "s" : ""}? This cannot be undone.`
      )
    ) {
      return
    }
    bulkDeleteMutation.mutate(ids)
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

      {stats && (
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InvoiceStat
            label="Total invoices"
            value={stats.totalInvoices}
            icon={<FileText className="size-4.5" />}
          />
          <InvoiceStat
            label="Total failed"
            value={stats.failed}
            icon={<CircleX className="size-4.5" />}
          />
          <InvoiceStat
            label="Total cancelled"
            value={stats.cancelled}
            icon={<CircleX className="size-4.5" />}
          />
          <InvoiceStat
            label="Receipts issued"
            value={stats.issuedReceipts}
            icon={<ReceiptText className="size-4.5" />}
          />
        </section>
      )}

      {!workspace ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No business selected. Create or select a business to view invoices.
          </p>
          <Link href="/businesses/new" className="mt-4 inline-block">
            <Button>Create business</Button>
          </Link>
        </div>
      ) : errorMessage ? (
        <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
      ) : invoices === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg border p-10 text-center">
          <p className="text-muted-foreground">No invoices yet.</p>
          <Link href="/invoices/new" className="mt-4 inline-block">
            <Button>Create your first invoice</Button>
          </Link>
        </div>
      ) : null}

      {invoices && invoices.length > 0 && (
        <>
          {selected.length > 0 && (
            <BulkActions
              invoices={invoices.filter((invoice) =>
                selected.includes(invoice.id)
              )}
              onClear={() => setSelected([])}
              onDelete={handleBulkDelete}
              onSubmitted={() => {
                setSelected([])
                invalidateScoped()
              }}
              deleting={bulkDeleteMutation.isPending}
            />
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
                        disabled={!selectableIds.includes(invoice.id)}
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
                          disabled={
                            invoice.registrationStatus === "REGISTERED" ||
                            invoice.registrationStatus === "PROCESSING"
                          }
                        />
                        {invoice.registrationStatus === "REGISTERED" &&
                          !hasIssuedReceipt(invoice) && (
                            <CancelButton
                              invoiceId={invoice.id}
                              invoiceNumber={invoice.number}
                              size="sm"
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
                          disabled={
                            deletingId === invoice.id || cannotDelete(invoice)
                          }
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

function InvoiceStat({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  )
}
