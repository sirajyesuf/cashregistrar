import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { hasIssuedReceipt } from "@/lib/invoice"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string")
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: "No invoices selected" }, { status: 400 })
  }

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids }, userId: user.id },
    select: {
      id: true,
      registrationStatus: true,
      receipt: { select: { status: true } },
    },
  })

  const deletableIds = invoices
    .filter(
      (invoice) =>
        invoice.registrationStatus !== "REGISTERED" &&
        !hasIssuedReceipt(invoice)
    )
    .map((invoice) => invoice.id)

  const deleted = deletableIds.length
    ? (
        await prisma.invoice.deleteMany({
          where: { id: { in: deletableIds }, userId: user.id },
        })
      ).count
    : 0

  return NextResponse.json({ deleted, skipped: ids.length - deleted })
}
