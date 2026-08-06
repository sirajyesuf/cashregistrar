"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatCents } from "@/lib/invoice"

type OverviewData = {
  stats: {
    totalUsers: number
    totalInvoices: number
    issuedReceipts: number
    totalReceipts: number
    totalRevenueCents: number
    totalTaxCents: number
    statusCounts: {
      REGISTERED: number
      CANCELLED: number
      FAILED: number
      UNREGISTERED: number
    }
  }
  recent: {
    id: string
    number: string
    date: string
    buyerLegalName: string | null
    grandTotal: string
    registrationStatus: string | null
  }[]
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/overview")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load overview")
        setData(await res.json())
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load overview")
      )
  }, [])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={data.stats.totalUsers} />
        <StatCard label="Invoices" value={data.stats.totalInvoices} />
        <StatCard
          label="Total revenue"
          value={formatCents(data.stats.totalRevenueCents)}
        />
        <StatCard
          label="Total tax"
          value={formatCents(data.stats.totalTaxCents)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Invoice status</h2>
          <div className="mt-3 space-y-2 text-sm">
            {[
              ["Registered", data.stats.statusCounts.REGISTERED],
              ["Cancelled", data.stats.statusCounts.CANCELLED],
              ["Failed", data.stats.statusCounts.FAILED],
              ["Unregistered", data.stats.statusCounts.UNREGISTERED],
            ].map(([label, count]) => (
              <div
                key={label as string}
                className="flex items-center justify-between"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">
                  {count as number}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Receipts</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Issued</span>
              <span className="font-medium tabular-nums">
                {data.stats.issuedReceipts}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium tabular-nums">
                {data.stats.totalReceipts}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Recent invoices</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 font-medium">Number</th>
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 text-right font-medium">Total</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="py-2">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {inv.number}
                    </Link>
                  </td>
                  <td className="py-2">{inv.buyerLegalName || "—"}</td>
                  <td className="py-2">{inv.date}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCents(Number(inv.grandTotal) * 100)}
                  </td>
                  <td className="py-2">
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
      </div>
    </div>
  )
}
