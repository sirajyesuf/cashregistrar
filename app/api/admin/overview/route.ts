import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function toCents(value: unknown): number {
  return Math.round(Number(value) * 100)
}

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  const [userCount, invoiceCount, receiptCount, issuedReceipts, invoices] =
    await Promise.all([
      prisma.user.count(),
      prisma.invoice.count(),
      prisma.receipt.count(),
      prisma.receipt.count({ where: { status: "ISSUED" } }),
      prisma.invoice.findMany({
        select: { grandTotal: true, taxAmount: true, registrationStatus: true },
      }),
    ])

  let totalRevenueCents = 0
  let totalTaxCents = 0
  const statusCounts = {
    REGISTERED: 0,
    CANCELLED: 0,
    FAILED: 0,
    UNREGISTERED: 0,
  }
  for (const inv of invoices) {
    totalRevenueCents += toCents(inv.grandTotal)
    totalTaxCents += toCents(inv.taxAmount)
    const status = inv.registrationStatus
    if (status === "REGISTERED") statusCounts.REGISTERED += 1
    else if (status === "CANCELLED") statusCounts.CANCELLED += 1
    else if (status === "FAILED") statusCounts.FAILED += 1
    else statusCounts.UNREGISTERED += 1
  }

  const recent = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      number: true,
      date: true,
      buyerLegalName: true,
      grandTotal: true,
      registrationStatus: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    stats: {
      totalUsers: userCount,
      totalInvoices: invoiceCount,
      issuedReceipts,
      totalReceipts: receiptCount,
      totalRevenueCents,
      totalTaxCents,
      statusCounts,
    },
    recent,
  })
}
