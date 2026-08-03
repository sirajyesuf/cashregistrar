import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function toCents(value: unknown): number {
  return Math.round(Number(value) * 100)
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      date: true,
      customerName: true,
      taxRate: true,
      taxAmount: true,
      grandTotal: true,
      createdAt: true,
      _count: { select: { lines: true } },
    },
  })

  const now = new Date()
  const thisMonth = monthKey(now)
  const customers = new Set<string>()
  const monthlyMap = new Map<string, { revenueCents: number; count: number }>()

  for (const inv of invoices) {
    customers.add(inv.customerName)
    const key = inv.date.slice(0, 7)
    const bucket = monthlyMap.get(key) ?? { revenueCents: 0, count: 0 }
    bucket.revenueCents += toCents(inv.grandTotal)
    bucket.count += 1
    monthlyMap.set(key, bucket)
  }

  let totalRevenueCents = 0
  let totalTaxCents = 0
  let monthRevenueCents = 0
  let monthTaxCents = 0
  let monthCount = 0

  for (const bucket of monthlyMap.values()) {
    totalRevenueCents += bucket.revenueCents
  }
  for (const inv of invoices) {
    totalTaxCents += toCents(inv.taxAmount)
  }

  const monthly: {
    key: string
    label: string
    revenueCents: number
    count: number
  }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = monthKey(d)
    const bucket = monthlyMap.get(key) ?? { revenueCents: 0, count: 0 }
    monthly.push({
      key,
      label: d.toLocaleDateString("en", { month: "short" }),
      revenueCents: bucket.revenueCents,
      count: bucket.count,
    })
    if (key === thisMonth) {
      monthRevenueCents = bucket.revenueCents
      monthCount = bucket.count
    }
  }

  for (const inv of invoices) {
    if (inv.date.slice(0, 7) === thisMonth) {
      monthTaxCents += toCents(inv.taxAmount)
    }
  }

  return NextResponse.json({
    stats: {
      totalInvoices: invoices.length,
      totalRevenueCents,
      totalTaxCents,
      monthRevenueCents,
      monthTaxCents,
      monthCount,
      customerCount: customers.size,
    },
    recent: invoices.slice(0, 6).map((inv) => ({
      id: inv.id,
      number: inv.number,
      date: inv.date,
      customerName: inv.customerName,
      grandTotal: inv.grandTotal,
      createdAt: inv.createdAt,
      _count: inv._count,
    })),
    monthly,
  })
}
