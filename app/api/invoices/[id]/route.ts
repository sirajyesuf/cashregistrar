import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await context.params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { lineNumber: "asc" } },
      receipt: true,
    },
  })

  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  return NextResponse.json({ invoice })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await context.params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  await prisma.invoice.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
