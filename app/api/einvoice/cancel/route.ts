import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { callEims } from "@/lib/einvoice/client"
import { getConfig } from "@/lib/einvoice/config"
import { parseEimsError } from "@/lib/einvoice/eims-error"

export const runtime = "nodejs"

function extractErrorMessage(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as { message?: unknown; body?: unknown }
    if (typeof d.message === "string") return d.message
    if (Array.isArray(d.body)) {
      const msgs = d.body
        .map((item) => {
          if (typeof item === "string") return item
          if (item && typeof item === "object") {
            const o = item as { errorMessage?: unknown; message?: unknown }
            if (typeof o.errorMessage === "string") return o.errorMessage
            if (typeof o.message === "string") return o.message
          }
          return ""
        })
        .filter(Boolean)
      if (msgs.length > 0) return msgs.join(" | ")
      if (typeof d.body[0] === "object") return JSON.stringify(d.body[0])
    }
  }
  return "EIMS cancellation failed"
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { invoiceId?: unknown; reasonCode?: unknown; remark?: unknown }
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
    select: { id: true, number: true, irn: true, registrationStatus: true },
  })
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }
  if (invoice.registrationStatus !== "REGISTERED" || !invoice.irn) {
    return NextResponse.json(
      { error: "Only registered invoices can be cancelled" },
      { status: 400 }
    )
  }

  const reasonCode =
    typeof body.reasonCode === "string" && body.reasonCode.trim()
      ? body.reasonCode.trim()
      : "1"
  const remark = typeof body.remark === "string" ? body.remark.trim() : ""

  const cfg = getConfig()
  const payload = {
    Irn: invoice.irn,
    ReasonCode: reasonCode,
    Remark: remark,
  }

  try {
    const result = await callEims("/v1/cancel", payload, {
      TIN: cfg.tin,
      SYSTEM_NUMBER: cfg.systemNumber,
    })

    const data = result.data as
      | { statusCode?: unknown; body?: { cancellationDate?: unknown } }
      | undefined
    const cancelled =
      result.ok && (data?.statusCode === 200 || data?.statusCode === undefined)

    if (cancelled) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          registrationStatus: "CANCELLED",
          registrationError: Prisma.DbNull,
        },
      })
      return NextResponse.json({
        ok: true,
        cancelledAt: data?.body?.cancellationDate ?? null,
      })
    }

    const eims = parseEimsError(data)
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        registrationError: {
          statusCode: eims.statusCode,
          message: eims.message,
          issues: eims.issues,
        },
      },
    })
    return NextResponse.json(
      { error: extractErrorMessage(data) },
      { status: result.ok ? 500 : result.status }
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "EIMS cancellation failed"
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { registrationError: { statusCode: null, message, issues: [] } },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
