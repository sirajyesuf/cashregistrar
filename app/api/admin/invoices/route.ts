import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("pageSize")) || 10)
  )
  const status = url.searchParams.get("status") ?? ""
  const businessId = url.searchParams.get("businessId") ?? ""

  const where = {
    ...(businessId ? { businessId } : {}),
    ...(status === "REGISTERED" || status === "CANCELLED" || status === "FAILED"
      ? { registrationStatus: status as "REGISTERED" | "CANCELLED" | "FAILED" }
      : status === "UNREGISTERED"
        ? { registrationStatus: null }
        : {}),
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        number: true,
        date: true,
        buyerLegalName: true,
        grandTotal: true,
        irn: true,
        registrationStatus: true,
        createdAt: true,
        _count: { select: { lines: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ])

  return NextResponse.json({ invoices, total, page, pageSize })
}
