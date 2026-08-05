import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { callEims } from "@/lib/einvoice/client"
import { getConfig } from "@/lib/einvoice/config"
import { buildRegisterPayload } from "@/lib/einvoice/payload"

export const runtime = "nodejs"

function extractErrorMessage(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as {
      message?: unknown
      details?: { errorMessage?: unknown }[]
      body?: unknown
    }
    if (Array.isArray(d.details)) {
      const msg = d.details
        .map((x) => (typeof x.errorMessage === "string" ? x.errorMessage : ""))
        .filter(Boolean)
        .join("; ")
      if (msg) return msg
    }
    if (Array.isArray(d.body)) {
      const msgs = d.body
        .map((item) => {
          if (item && typeof item === "object") {
            const o = item as {
              portion?: unknown
              errorMessage?: unknown
              message?: unknown
            }
            if (Array.isArray(o.errorMessage)) {
              return o.errorMessage
                .filter((m) => typeof m === "string")
                .join("; ")
            }
            if (typeof o.message === "string") return o.message
          }
          if (typeof item === "string") return item
          return ""
        })
        .filter(Boolean)
      if (msgs.length > 0) return msgs.join(" | ")
      if (typeof d.body[0] === "object") return JSON.stringify(d.body[0])
    }
    if (typeof d.message === "string") return d.message
  }
  return "EIMS registration failed"
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { invoiceId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const invoiceId =
    typeof body.invoiceId === "string" ? body.invoiceId.trim() : ""
  if (!invoiceId) {
    return NextResponse.json(
      { error: "invoiceId is required" },
      { status: 400 }
    )
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true },
  })
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  if (invoice.registrationStatus === "REGISTERED") {
    return NextResponse.json({ ok: true, irn: invoice.irn })
  }

  if (invoice.transactionType === "B2B" && !invoice.buyerTin) {
    return NextResponse.json(
      { error: "B2B invoices require a buyer TIN" },
      { status: 400 }
    )
  }

  const seller = await prisma.sellerProfile.findFirst()
  let counter = await prisma.counter.findUnique({ where: { name: "eims" } })
  if (!counter) {
    counter = await prisma.counter.create({ data: { name: "eims", value: 1 } })
  }
  const previous = await prisma.invoice.findFirst({
    where: {
      irn: { not: null },
      registrationStatus: "REGISTERED",
      id: { not: invoice.id },
    },
    orderBy: { createdAt: "desc" },
    select: { irn: true },
  })

  const cfg = getConfig()
  const payload = buildRegisterPayload({
    invoice,
    seller,
    invoiceCounter: counter.value,
    previousIrn: previous?.irn ?? null,
  })

  try {
    const result = await callEims("/v1/register", payload, {
      TIN: cfg.tin,
      SYSTEM_NUMBER: cfg.systemNumber,
    })

    const data = result.data as { body?: { irn?: unknown } } | undefined
    const irn = typeof data?.body?.irn === "string" ? data.body.irn : null

    if (result.ok && irn) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          irn,
          registrationStatus: "REGISTERED",
          registrationError: null,
          registeredAt: new Date(),
        },
      })
      await prisma.counter.update({
        where: { name: "eims" },
        data: { value: { increment: 1 } },
      })
      return NextResponse.json({ ok: true, irn })
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        registrationStatus: "FAILED",
        registrationError: extractErrorMessage(data),
      },
    })
    return NextResponse.json(
      { error: extractErrorMessage(data) },
      { status: result.ok ? 500 : result.status }
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "EIMS registration failed"
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        registrationStatus: "FAILED",
        registrationError: message,
      },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
