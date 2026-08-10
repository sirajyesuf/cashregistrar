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
      morCredential: { select: { tin: true, systemNumber: true } },
      _count: { select: { branches: true } },
    },
  })

  return NextResponse.json({
    businesses: businesses.map(({ morCredential, ...business }) => ({
      ...business,
      configured: Boolean(morCredential),
      tin: morCredential?.tin ?? null,
      systemNumber: morCredential?.systemNumber ?? null,
    })),
    config: {
      baseUrl: process.env.EINVOICE_BASE_URL ?? "https://core.mor.gov.et",
    },
  })
}
