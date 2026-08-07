import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  const { id } = await context.params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { lineNumber: "asc" } },
      receipt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  return NextResponse.json({ invoice })
}
