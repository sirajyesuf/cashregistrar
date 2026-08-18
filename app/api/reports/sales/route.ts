import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { getWorkspace, getWorkspaceAccess } from "@/lib/workspace"

export const runtime = "nodejs"

const TIME_ZONE = "Africa/Addis_Ababa"

function toCents(value: unknown): number {
  return Math.round(Number(value) * 100)
}

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

type Bucket = { count: number; totalCents: number }

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const businessId = url.searchParams.get("businessId")
  const branchId = url.searchParams.get("branchId")
  const from = url.searchParams.get("from") ?? todayKey()
  const to = url.searchParams.get("to") ?? todayKey()

  const workspace =
    businessId && branchId
      ? await getWorkspaceAccess(user.id, businessId, branchId)
      : await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "No workspace selected" }, { status: 409 })
  }

  // Cashiers only ever see their own sales; owners/managers see the branch.
  const where = {
    businessId: workspace.businessId,
    branchId: workspace.branchId,
    ...(workspace.role === "CASHIER" ? { userId: user.id } : {}),
    date: { gte: from, lte: to },
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      subtotal: true,
      taxAmount: true,
      grandTotal: true,
      transactionType: true,
      paymentMode: true,
      registrationStatus: true,
      userId: true,
      receipt: { select: { status: true } },
    },
  })

  let count = 0
  let subtotalCents = 0
  let taxCents = 0
  let grandTotalCents = 0
  let registered = 0
  let cancelled = 0
  let failed = 0
  let issuedReceipts = 0

  const paymentModes = new Map<string, Bucket>()
  const byType = new Map<string, Bucket>()
  const byCashier = new Map<string, Bucket>()

  const isCashier = workspace.role === "CASHIER"

  for (const inv of invoices) {
    count += 1
    subtotalCents += toCents(inv.subtotal)
    taxCents += toCents(inv.taxAmount)
    grandTotalCents += toCents(inv.grandTotal)
    if (inv.registrationStatus === "REGISTERED") registered += 1
    if (inv.registrationStatus === "CANCELLED") cancelled += 1
    if (inv.registrationStatus === "FAILED") failed += 1
    if (inv.receipt?.status === "ISSUED") issuedReceipts += 1

    const mode = inv.paymentMode || "CASH"
    const modeBucket = paymentModes.get(mode) ?? { count: 0, totalCents: 0 }
    modeBucket.count += 1
    modeBucket.totalCents += toCents(inv.grandTotal)
    paymentModes.set(mode, modeBucket)

    const typeBucket = byType.get(inv.transactionType) ?? { count: 0, totalCents: 0 }
    typeBucket.count += 1
    typeBucket.totalCents += toCents(inv.grandTotal)
    byType.set(inv.transactionType, typeBucket)

    if (!isCashier) {
      const cashierBucket = byCashier.get(inv.userId) ?? { count: 0, totalCents: 0 }
      cashierBucket.count += 1
      cashierBucket.totalCents += toCents(inv.grandTotal)
      byCashier.set(inv.userId, cashierBucket)
    }
  }

  let cashiers: { id: string; name: string; count: number; totalCents: number }[] =
    []
  if (!isCashier && byCashier.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...byCashier.keys()] } },
      select: { id: true, name: true },
    })
    const names = new Map(users.map((u) => [u.id, u.name]))
    cashiers = [...byCashier.entries()]
      .map(([id, bucket]) => ({ id, name: names.get(id) ?? "Unknown", ...bucket }))
      .sort((a, b) => b.totalCents - a.totalCents)
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    from,
    to,
    scopedToCashier: isCashier,
    totals: {
      count,
      subtotalCents,
      taxCents,
      grandTotalCents,
      registered,
      cancelled,
      failed,
      issuedReceipts,
    },
    byPaymentMode: [...paymentModes.entries()]
      .map(([mode, bucket]) => ({ mode, ...bucket }))
      .sort((a, b) => b.totalCents - a.totalCents),
    byType: (["B2B", "B2C"] as const).map((type) => ({
      type,
      count: byType.get(type)?.count ?? 0,
      totalCents: byType.get(type)?.totalCents ?? 0,
    })),
    byCashier: cashiers,
  })
}
