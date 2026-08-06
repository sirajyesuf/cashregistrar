import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  const token = await prisma.eimsToken.findUnique({
    where: { id: "singleton" },
    select: { expiresAt: true, updatedAt: true },
  })

  const counters = await prisma.counter.findMany({
    orderBy: { name: "asc" },
    select: { name: true, value: true },
  })

  return NextResponse.json({
    token: {
      exists: Boolean(token),
      expiresAt: token?.expiresAt ?? null,
      updatedAt: token?.updatedAt ?? null,
      valid: token ? token.expiresAt.getTime() > Date.now() : false,
    },
    counters,
    config: {
      tin: process.env.EINVOICE_TIN ?? "",
      systemNumber: process.env.EINVOICE_SYSTEM_NUMBER ?? "",
      systemType: process.env.EINVOICE_SYSTEM_TYPE ?? "",
      baseUrl: process.env.EINVOICE_BASE_URL ?? "https://core.mor.gov.et",
    },
  })
}
