"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Banknote, Percent, Receipt, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCents } from "@/lib/invoice"
import { cn } from "@/lib/utils"
import { StatusBadge } from "./status-badge"

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

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof Users
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className="flex size-8 items-center justify-center rounded-lg border bg-muted/50">
            <Icon className="size-4" />
          </span>
        </div>
        <p className="truncate text-2xl font-semibold tabular-nums">
          {value}
        </p>
      </CardContent>
    </Card>
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
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything happening across the business.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={data.stats.totalUsers} icon={Users} />
        <StatCard
          label="Invoices"
          value={data.stats.totalInvoices}
          icon={Receipt}
        />
        <StatCard
          label="Total revenue"
          value={formatCents(data.stats.totalRevenueCents)}
          icon={Banknote}
        />
        <StatCard
          label="Total tax"
          value={formatCents(data.stats.totalTaxCents)}
          icon={Percent}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Invoice status</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {[
              [
                "Registered",
                data.stats.statusCounts.REGISTERED,
                "bg-success",
              ],
              [
                "Cancelled",
                data.stats.statusCounts.CANCELLED,
                "bg-muted-foreground/40",
              ],
              ["Failed", data.stats.statusCounts.FAILED, "bg-destructive"],
              [
                "Unregistered",
                data.stats.statusCounts.UNREGISTERED,
                "bg-muted-foreground/20",
              ],
            ].map(([label, count, dot]) => (
              <div
                key={label as string}
                className="flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className={cn("size-2 rounded-full", dot)} />
                  {label}
                </span>
                <span className="font-medium tabular-nums">
                  {count as number}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Receipts</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
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
        <div className="mt-3">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {inv.number}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.buyerLegalName || "—"}</TableCell>
                  <TableCell>{inv.date}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(Number(inv.grandTotal) * 100)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={inv.registrationStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
