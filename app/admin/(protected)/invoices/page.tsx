"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { formatCents, moneyToCents } from "@/lib/invoice"
import { StatusBadge } from "../status-badge"

type AdminInvoice = {
  id: string
  number: string
  date: string
  buyerLegalName: string | null
  grandTotal: string
  registrationStatus: string | null
  branch: { name: string } | null
  _count: { lines: number }
}

type AdminBusiness = {
  id: string
  name: string
  _count: { invoices: number; branches: number }
}

const STATUSES = [
  "",
  "REGISTERED",
  "CANCELLED",
  "FAILED",
  "UNREGISTERED",
  "PROCESSING",
]
const PAGE_SIZE = 10

export default function AdminInvoicesPage() {
  const [businessId, setBusinessId] = useState("")
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")

  const { data: businesses } = useQuery({
    queryKey: ["admin", "businesses"],
    queryFn: async () => {
      const res = await fetch("/api/admin/businesses")
      if (!res.ok) throw new Error("Failed to load businesses")
      const body = (await res.json()) as { businesses: AdminBusiness[] }
      return body.businesses
    },
  })

  const {
    data,
    error,
  } = useQuery({
    queryKey: ["admin", "invoices", businessId, status, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/invoices?page=${page}&pageSize=${PAGE_SIZE}&status=${status}&businessId=${businessId}`
      )
      if (!res.ok) throw new Error("Failed to load invoices")
      return (await res.json()) as {
        invoices: AdminInvoice[]
        total: number
      }
    },
  })

  const invoices = data?.invoices ?? null
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
        <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invoices across tenants.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={businessId}
          onValueChange={(value) => {
            setBusinessId(value ?? "")
            setPage(1)
          }}
        >
          <SelectTrigger className="w-56" aria-label="Filter by business">
            <SelectValue placeholder="All businesses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All businesses</SelectItem>
            {businesses?.map((business) => (
              <SelectItem key={business.id} value={business.id}>
                {business.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToggleGroup
          value={status ? [status] : []}
          onValueChange={(values) => {
            setStatus(values[0] ?? "")
            setPage(1)
          }}
        >
          {STATUSES.map((s) => (
            <ToggleGroupItem key={s} value={s} variant="outline" size="sm">
              {s === "" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!error && !invoices && (
    <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {invoices && (
        <div className="rounded-xl border bg-card">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Branch</TableHead>
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
                  <TableCell className="text-muted-foreground">
                    {inv.branch?.name ?? "—"}
                  </TableCell>
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
                      nativeButton={false}
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
