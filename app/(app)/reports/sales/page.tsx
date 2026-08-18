"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Printer } from "lucide-react"
import { useWorkspace } from "@/components/workspace-provider"
import { DateRangePicker } from "@/components/date-range-picker"
import { Button } from "@/components/ui/button"
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
import { formatCents } from "@/lib/invoice"

type ModeBucket = { mode: string; count: number; totalCents: number }
type TypeBucket = { type: string; count: number; totalCents: number }
type CashierBucket = { id: string; name: string; count: number; totalCents: number }

type SalesReport = {
  generatedAt: string
  from: string
  to: string
  scopedToCashier: boolean
  totals: {
    count: number
    subtotalCents: number
    taxCents: number
    grandTotalCents: number
    registered: number
    cancelled: number
    failed: number
    issuedReceipts: number
  }
  byPaymentMode: ModeBucket[]
  byType: TypeBucket[]
  byCashier: CashierBucket[]
}

const TIME_ZONE = "Africa/Addis_Ababa"

type Preset = "today" | "all" | "custom"

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "all", label: "All time" },
]

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatRangeLabel(from: string, to: string): string {
  const fromDate = parseISO(from)
  const toDate = parseISO(to)
  if (from === to) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(fromDate)
  }
  return `${format(fromDate, "MMM d, y")} – ${format(toDate, "MMM d, y")}`
}

function SummaryBox({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  )
}

export default function SalesReportPage() {
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
    if (next === "today") {
      const today = todayKey()
      setFrom(today)
      setTo(today)
    } else {
      setFrom("")
      setTo("")
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
      ? {
          from: from ? parseISO(from) : undefined,
          to: to ? parseISO(to) : undefined,
        }
      : undefined
  const selectedRange = pendingRange ?? appliedRange

  const { data } = useQuery({
    queryKey: ["sales-report", businessId, branchId, from, to],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (businessId) params.set("businessId", businessId)
      if (branchId) params.set("branchId", branchId)
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      const qs = params.toString()
      const res = await fetch(`/api/reports/sales${qs ? `?${qs}` : ""}`)
      if (!res.ok) throw new Error("Failed to load report")
      return (await res.json()) as SalesReport
    },
    enabled: Boolean(workspace),
  })

  const loadingSkeleton = (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl p-6 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Sales Report</h1>
          <p className="text-sm text-muted-foreground">
            End-of-day sales summary
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Print
          </Button>
        </div>
      </div>

      {workspacePending ? (
        loadingSkeleton
      ) : !workspace ? (
        <Empty className="rounded-xl border border-dashed p-10">
          <EmptyContent>
            <EmptyTitle>No business selected</EmptyTitle>
            <EmptyDescription>
              Create or select a business to view the report.
            </EmptyDescription>
          </EmptyContent>
        </Empty>
      ) : !data ? (
        loadingSkeleton
      ) : (
        <div className="rounded-xl border bg-card p-6 print:rounded-none print:border-0 print:p-0">
          <div className="mb-6 border-b pb-4 text-center">
            <h2 className="text-lg font-bold uppercase tracking-wide">
              Sales Report
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatRangeLabel(data.from, data.to)}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.scopedToCashier
                ? "Cashier sales report"
                : "Branch sales report"}
            </p>
          </div>

          {data.totals.count === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No sales in this range.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryBox
                  label="Invoices"
                  value={String(data.totals.count)}
                />
                <SummaryBox
                  label="Subtotal"
                  value={formatCents(data.totals.subtotalCents)}
                />
                <SummaryBox
                  label="Tax"
                  value={formatCents(data.totals.taxCents)}
                />
                <SummaryBox
                  label="Grand total"
                  value={formatCents(data.totals.grandTotalCents)}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryBox
                  label="Registered"
                  value={String(data.totals.registered)}
                />
                <SummaryBox
                  label="Receipts issued"
                  value={String(data.totals.issuedReceipts)}
                />
                <SummaryBox
                  label="Cancelled"
                  value={String(data.totals.cancelled)}
                />
                <SummaryBox
                  label="Failed"
                  value={String(data.totals.failed)}
                />
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Payment modes</h3>
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Mode</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byPaymentMode.map((bucket) => (
                          <TableRow key={bucket.mode}>
                            <TableCell className="font-medium">
                              {bucket.mode}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {bucket.count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCents(bucket.totalCents)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {data.byPaymentMode.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="py-6 text-center text-sm text-muted-foreground"
                            >
                              No payment data
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold">Transaction types</h3>
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byType.map((bucket) => (
                          <TableRow key={bucket.type}>
                            <TableCell className="font-medium">
                              {bucket.type}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {bucket.count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCents(bucket.totalCents)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              </div>

              {data.byCashier.length > 0 && (
                <section className="mt-8">
                  <h3 className="mb-2 text-sm font-semibold">By cashier</h3>
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Cashier</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byCashier.map((bucket) => (
                          <TableRow key={bucket.id}>
                            <TableCell className="font-medium">
                              {bucket.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {bucket.count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCents(bucket.totalCents)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              <p className="mt-8 border-t pt-3 text-right text-xs text-muted-foreground">
                Generated {new Date(data.generatedAt).toLocaleString()}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
