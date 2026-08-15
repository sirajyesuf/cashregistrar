"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import type { DateRange } from "react-day-picker"
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from "recharts"
import {
  FilePlus2,
  FileText,
  Landmark,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react"
import { useUser } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"
import { DateRangePicker } from "@/components/date-range-picker"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCents } from "@/lib/invoice"

type TrendPoint = {
  key: string
  label: string
  revenueCents: number
  count: number
}

type TopProduct = {
  name: string
  quantity: number
  revenueCents: number
}

type TypeSplit = {
  type: string
  count: number
  revenueCents: number
}

type RecentInvoice = {
  id: string
  number: string
  date: string
  customerName: string | null
  grandTotal: string
  _count: { lines: number }
}

type DashboardData = {
  stats: {
    invoiceCount: number
    revenueCents: number
    taxCents: number
    customerCount: number
  }
  trend: TrendPoint[]
  topProducts: TopProduct[]
  byType: TypeSplit[]
  recent: RecentInvoice[]
}

type Preset = "today" | "custom"

const TIME_ZONE = "Africa/Addis_Ababa"

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
]

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

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

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date)
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

function RevenueChart({ data }: { data: TrendPoint[] }) {
  const config: ChartConfig = {
    revenue: { label: "Revenue", color: "var(--chart-1)" },
  }
  const hasData = data.some((point) => point.revenueCents > 0)
  if (!hasData) return <ChartEmpty />

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent formatter={(value) => formatCents(Number(value))} />
          }
        />
        <Line
          type="monotone"
          dataKey="revenueCents"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

function TypeChart({ data }: { data: TypeSplit[] }) {
  const config: ChartConfig = {
    B2B: { label: "B2B", color: "var(--chart-1)" },
    B2C: { label: "B2C", color: "var(--chart-2)" },
  }
  const chartData = data.map((item) => ({
    ...item,
    fill: `var(--color-${item.type})`,
  }))
  if (chartData.every((item) => item.count === 0)) return <ChartEmpty />

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie data={chartData} dataKey="count" nameKey="type" innerRadius={60} strokeWidth={5}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

function ChartEmpty() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      No data in this range
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useUser()
  const { workspace, isPending: workspacePending } = useWorkspace()
  const businessId = workspace?.businessId ?? ""
  const branchId = workspace?.branchId ?? ""
  const [preset, setPreset] = useState<Preset>("today")
  const [from, setFrom] = useState(todayKey())
  const [to, setTo] = useState(todayKey())
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>()

  function applyPreset(next: Preset) {
    setPreset(next)
    setPendingRange(undefined)
    const today = todayKey()
    switch (next) {
      case "today":
        setFrom(today)
        setTo(today)
        break
      case "custom":
        break
    }
  }

  function handleRangeChange(range: DateRange | undefined) {
    setPreset("custom")
    if (!range?.from) {
      setPendingRange(undefined)
      setFrom("")
      setTo("")
      return
    }
    if (!range.to) {
      setPendingRange(range)
      return
    }
    setPendingRange(undefined)
    setFrom(format(range.from, "yyyy-MM-dd"))
    setTo(format(range.to, "yyyy-MM-dd"))
  }

  const appliedRange: DateRange | undefined =
    from || to
      ? { from: from ? parseISO(from) : undefined, to: to ? parseISO(to) : undefined }
      : undefined
  const selectedRange = pendingRange ?? appliedRange

  const range = useMemo(
    () => ({ from: from || null, to: to || null }),
    [from, to]
  )

  const { data } = useQuery({
    queryKey: ["dashboard", businessId, branchId, range.from, range.to],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (businessId) params.set("businessId", businessId)
      if (branchId) params.set("branchId", branchId)
      if (range.from) params.set("from", range.from)
      if (range.to) params.set("to", range.to)
      const qs = params.toString()
      const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ""}`)
      if (!res.ok) throw new Error("Failed to load dashboard")
      return (await res.json()) as DashboardData
    },
    enabled: Boolean(workspace),
    placeholderData: (previousData) => previousData,
  })

  const now = new Date()
  const dateLabel = formatDateLabel(now)
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there"
  const presetLabel =
    preset === "custom"
      ? from || to
        ? `${from} – ${to}`
        : "All time"
      : (PRESETS.find((p) => p.value === preset)?.label ?? "All time")

  const stats = data?.stats

  const loadingSkeleton = (
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
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {workspacePending ? (
        loadingSkeleton
      ) : !workspace ? (
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
        loadingSkeleton
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{dateLabel}</p>
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

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Overview</h2>
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                variant="outline"
                size="sm"
                value={[preset]}
                onValueChange={(value) => {
                  if (value[0]) applyPreset(value[0] as Preset)
                }}
              >
                {PRESETS.map((p) => (
                  <ToggleGroupItem key={p.value} value={p.value}>
                    {p.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <DateRangePicker
                value={selectedRange}
                onValueChange={handleRangeChange}
              />
            </div>
          </div>

          {stats && (
            <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Invoices"
                value={formatNumber(stats.invoiceCount)}
                sub={presetLabel}
                icon={<FileText className="size-4.5" />}
              />
              <StatCard
                label="Revenue"
                value={formatCents(stats.revenueCents)}
                sub={presetLabel}
                icon={<Wallet className="size-4.5" />}
              />
              <StatCard
                label="Tax Collected"
                value={formatCents(stats.taxCents)}
                sub={presetLabel}
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

          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue trend</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueChart data={data.trend} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>B2B vs B2C</CardTitle>
              </CardHeader>
              <CardContent>
                <TypeChart data={data.byType} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Top products</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No products sold in this range
                  </p>
                ) : (
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Units sold</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topProducts.map((product) => (
                          <TableRow key={product.name}>
                            <TableCell className="font-medium">
                              {product.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(product.quantity)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCents(product.revenueCents)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
