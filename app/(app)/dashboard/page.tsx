"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowUpRight,
  FilePlus2,
  FileText,
  Landmark,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react"
import { useUser } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
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

type RecentInvoice = {
  id: string
  number: string
  date: string
  customerName: string
  grandTotal: string
  _count: { lines: number }
}

type DashboardData = {
  stats: {
    totalInvoices: number
    totalRevenueCents: number
    monthRevenueCents: number
    monthTaxCents: number
    monthCount: number
    customerCount: number
  }
  recent: RecentInvoice[]
  monthly: {
    key: string
    label: string
    revenueCents: number
    count: number
  }[]
}

const TIME_ZONE = "Africa/Addis_Ababa"

function greeting(date: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: TIME_ZONE,
    }).format(date)
  )
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatDateLabels(date: Date): {
  gregorian: string
  ethiopian: string
} {
  return {
    gregorian: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: TIME_ZONE,
    }).format(date),
    ethiopian: new Intl.DateTimeFormat("am-ET-u-ca-ethiopic", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: TIME_ZONE,
    }).format(date),
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value)
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {icon}
          </span>
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useUser()
  const { workspace } = useWorkspace()
  const businessId = workspace?.businessId ?? ""
  const branchId = workspace?.branchId ?? ""

  const { data } = useQuery({
    queryKey: ["dashboard", businessId, branchId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (businessId) params.set("businessId", businessId)
      if (branchId) params.set("branchId", branchId)
      const qs = params.toString()
      const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ""}`)
      if (!res.ok) throw new Error("Failed to load dashboard")
      return (await res.json()) as DashboardData
    },
    enabled: Boolean(workspace),
  })

  const now = new Date()
  const dateLabels = formatDateLabels(now)
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there"

  const stats = data?.stats

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {!workspace ? (
        <Empty className="rounded-xl border border-dashed p-10">
          <EmptyContent>
            <EmptyTitle>No business selected</EmptyTitle>
            <EmptyDescription>
              Create a business to get started.
            </EmptyDescription>
            <Link href="/businesses/new">
              <Button>Create business</Button>
            </Link>
          </EmptyContent>
        </Empty>
      ) : !data ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-16 w-2/3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {dateLabels.gregorian}
              </p>
              <p className="text-sm text-muted-foreground">
                {dateLabels.ethiopian}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                {greeting(now)}, {firstName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Here’s what’s happening with your business.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/invoices">
                <Button variant="outline">
                  <ReceiptText data-icon="inline-start" />
                  My Invoices
                </Button>
              </Link>
              <Link href="/invoices/new">
                <Button>
                  <FilePlus2 data-icon="inline-start" />
                  New Invoice
                </Button>
              </Link>
            </div>
          </div>

          {stats && (
            <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Invoices"
                value={formatNumber(stats.totalInvoices)}
                sub="Issued all time"
                icon={<FileText className="size-4.5" />}
              />
              <StatCard
                label="Revenue This Month"
                value={formatCents(stats.monthRevenueCents)}
                sub={
                  stats.monthCount > 0
                    ? `${formatNumber(stats.monthCount)} ${
                        stats.monthCount === 1 ? "invoice" : "invoices"
                      }`
                    : "No invoices yet"
                }
                icon={<Wallet className="size-4.5" />}
              />
              <StatCard
                label="Tax Collected"
                value={formatCents(stats.monthTaxCents)}
                sub="This month"
                icon={<Landmark className="size-4.5" />}
              />
              <StatCard
                label="Customers"
                value={formatNumber(stats.customerCount)}
                sub="Unique buyers"
                icon={<Users className="size-4.5" />}
              />
            </section>
          )}

          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Invoices</h2>
              {data.recent.length > 0 && (
                <Link
                  href="/invoices"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              )}
            </div>

            {data.recent.length === 0 ? (
              <Empty className="rounded-xl border border-dashed p-10">
                <EmptyContent>
                  <EmptyTitle>No invoices yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first invoice to get started.
                  </EmptyDescription>
                  <Link href="/invoices/new">
                    <Button>Create your first invoice</Button>
                  </Link>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recent.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.number}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.customerName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.date.slice(0, 10)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCents(Number(invoice.grandTotal) * 100)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`View ${invoice.number}`}
                          >
                            <ArrowUpRight className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
