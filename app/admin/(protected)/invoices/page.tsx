"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Pagination } from "@/components/ui/pagination"
import { formatCents, moneyToCents } from "@/lib/invoice"

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
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
            className={
              status === s
                ? "rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                : "rounded-md border px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
            }
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
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Lines</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{inv.buyerLegalName || "—"}</td>
                  <td className="px-4 py-2">{inv.date}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {inv._count.lines}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCents(moneyToCents(inv.grandTotal))}
                  </td>
                  <td className="px-4 py-2">
                    {inv.registrationStatus === "REGISTERED" ? (
                      <Badge variant="success">Registered</Badge>
                    ) : inv.registrationStatus === "CANCELLED" ? (
                      <Badge variant="outline">Cancelled</Badge>
                    ) : inv.registrationStatus === "FAILED" ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <Badge variant="outline">Unregistered</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
