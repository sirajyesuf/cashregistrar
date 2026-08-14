import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { getWorkspace, getWorkspaceAccess, workspaceInvoiceScope } from "@/lib/workspace"

export const runtime = "nodejs"

function toCents(value: unknown): number {
  return Math.round(Number(value) * 100)
}

function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

type Bucket = { revenueCents: number; count: number }

type TrendPoint = {
  key: string
  label: string
  revenueCents: number
  count: number
}

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const businessId = url.searchParams.get("businessId")
  const branchId = url.searchParams.get("branchId")
  const from = url.searchParams.get("from") ?? undefined
  const to = url.searchParams.get("to") ?? undefined

  const workspace =
    businessId && branchId
      ? await getWorkspaceAccess(user.id, businessId, branchId)
      : await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "No workspace selected" }, { status: 409 })
  }

  const dateFilter = from && to ? { date: { gte: from, lte: to } } : {}

  const invoices = await prisma.invoice.findMany({
    where: { ...workspaceInvoiceScope(workspace), ...dateFilter },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      date: true,
      buyerLegalName: true,
      taxAmount: true,
      grandTotal: true,
      transactionType: true,
      _count: { select: { lines: true } },
    },
  })

  let revenueCents = 0
  let taxCents = 0
  const customers = new Set<string>()
  const byTypeMap = new Map<string, Bucket>()
  const dailyMap = new Map<string, Bucket>()
  const monthlyMap = new Map<string, Bucket>()

  for (const inv of invoices) {
    if (inv.buyerLegalName) customers.add(inv.buyerLegalName)
    revenueCents += toCents(inv.grandTotal)
    taxCents += toCents(inv.taxAmount)

    const type = inv.transactionType
    const typeBucket = byTypeMap.get(type) ?? { revenueCents: 0, count: 0 }
    typeBucket.revenueCents += toCents(inv.grandTotal)
    typeBucket.count += 1
    byTypeMap.set(type, typeBucket)

    const day = inv.date.slice(0, 10)
    const dayBucket = dailyMap.get(day) ?? { revenueCents: 0, count: 0 }
    dayBucket.revenueCents += toCents(inv.grandTotal)
    dayBucket.count += 1
    dailyMap.set(day, dayBucket)

    const month = inv.date.slice(0, 7)
    const monthBucket = monthlyMap.get(month) ?? { revenueCents: 0, count: 0 }
    monthBucket.revenueCents += toCents(inv.grandTotal)
    monthBucket.count += 1
    monthlyMap.set(month, monthBucket)
  }

  const trend: TrendPoint[] = []
  if (from && to) {
    // "Today" collapses to a single day, so show the last 7 days for context.
    const startKey =
      from === to ? formatDateKey(addDays(parseDateKey(to), -6)) : from
    const end = parseDateKey(to)
    for (let d = parseDateKey(startKey); d <= end; d = addDays(d, 1)) {
      const key = formatDateKey(d)
      const bucket = dailyMap.get(key) ?? { revenueCents: 0, count: 0 }
      trend.push({
        key,
        label: d.toLocaleDateString("en", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        revenueCents: bucket.revenueCents,
        count: bucket.count,
      })
    }
  } else {
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const bucket = monthlyMap.get(key) ?? { revenueCents: 0, count: 0 }
      trend.push({
        key,
        label: d.toLocaleDateString("en", { month: "short" }),
        revenueCents: bucket.revenueCents,
        count: bucket.count,
      })
    }
  }

  const lineGroups = await prisma.invoiceLine.groupBy({
    by: ["description"],
    where: { invoice: { ...workspaceInvoiceScope(workspace), ...dateFilter } },
    _sum: { quantity: true, total: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  })
  const topProducts = lineGroups.map((group) => ({
    name: group.description,
    quantity: Number(group._sum.quantity ?? 0),
    revenueCents: toCents(group._sum.total ?? 0),
  }))

  const byType = (["B2B", "B2C"] as const).map((type) => {
    const bucket = byTypeMap.get(type)
    return {
      type,
      count: bucket?.count ?? 0,
      revenueCents: bucket?.revenueCents ?? 0,
    }
  })

  return NextResponse.json({
    stats: {
      invoiceCount: invoices.length,
      revenueCents,
      taxCents,
      customerCount: customers.size,
    },
    trend,
    topProducts,
    byType,
    recent: invoices.slice(0, 6).map((inv) => ({
      id: inv.id,
      number: inv.number,
      date: inv.date,
      customerName: inv.buyerLegalName,
      grandTotal: inv.grandTotal,
      _count: inv._count,
    })),
  })
}
