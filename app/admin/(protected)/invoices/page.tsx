"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"
import { formatCents, moneyToCents } from "@/lib/invoice"
import { StatusBadge } from "../status-badge"

type AdminInvoice = {
  id: string
  number: string
  date: string
  buyerLegalName: string | null
  grandTotal: string
  registrationStatus: string | null
  _count: { lines: number }
}

const STATUSES = ["", "REGISTERED", "CANCELLED", "FAILED", "UNREGISTERED"]
const PAGE_SIZE = 10

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<AdminInvoice[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(
      `/api/admin/invoices?page=${page}&pageSize=${PAGE_SIZE}&status=${status}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load invoices")
        const body = (await res.json()) as {
          invoices: AdminInvoice[]
          total: number
        }
        if (cancelled) return
        setInvoices(body.invoices)
        setTotal(body.total)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load invoices"
          )
      })
    return () => {
      cancelled = true
    }
  }, [page, status])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every invoice from every user.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              status === s
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && !invoices && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {invoices && (
        <div className="rounded-xl border bg-card">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {inv.number}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.buyerLegalName || "—"}</TableCell>
                  <TableCell>{inv.date}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {inv._count.lines}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(moneyToCents(inv.grandTotal))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={inv.registrationStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/admin/invoices/${inv.id}`} />}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
