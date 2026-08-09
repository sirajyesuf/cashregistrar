import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { invoices: true, branches: true } },
    },
  })

  return NextResponse.json({ businesses })
}
