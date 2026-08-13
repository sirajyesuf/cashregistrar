import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { callEims } from "@/lib/einvoice/client"
import { getConfig } from "@/lib/einvoice/config"
import {
  cancellationReasonCode,
  DEFAULT_CANCELLATION_REASON,
  isCancellationReason,
} from "@/lib/einvoice/cancellation-reason"
import { isEimsAuthError, parseEimsError } from "@/lib/einvoice/eims-error"
import { parseCancellationDate } from "@/lib/einvoice/cancellation-date"
import { hasIssuedReceipt } from "@/lib/invoice"
import { canAccessInvoice, getWorkspace } from "@/lib/workspace"

export const runtime = "nodejs"

function extractErrorMessage(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as { message?: unknown; body?: unknown; msg?: unknown }
    if (Array.isArray(d.body)) {
      const msgs = d.body
        .map((item) => {
          if (typeof item === "string") return item
          if (item && typeof item === "object") {
            const o = item as {
              errorMessage?: unknown
              message?: unknown
              msg?: unknown
            }
            if (typeof o.errorMessage === "string") return o.errorMessage
            if (typeof o.message === "string") return o.message
            if (typeof o.msg === "string") return o.msg
          }
          return ""
        })
        .filter(Boolean)
      if (msgs.length > 0) return msgs.join(" | ")
      if (d.body.length > 0) return JSON.stringify(d.body)
    }
    if (typeof d.body === "string" && d.body) return d.body
    if (d.body && typeof d.body === "object") {
      const b = d.body as { msg?: unknown; message?: unknown }
      if (typeof b.msg === "string" && b.msg) return b.msg
      if (typeof b.message === "string" && b.message) return b.message
    }
    if (typeof d.msg === "string" && d.msg) return d.msg
    if (typeof d.message === "string") return d.message
  }
  return "EIMS cancellation failed"
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { invoiceId?: unknown; reason?: unknown; remark?: unknown }
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
    select: {
      id: true,
      number: true,
      irn: true,
      registrationStatus: true,
      businessId: true,
      branchId: true,
      receipt: { select: { status: true } },
    },
  })
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const workspace = await getWorkspace(user.id)
  if (!workspace || !canAccessInvoice(workspace, invoice)) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }
  if (invoice.registrationStatus !== "REGISTERED" || !invoice.irn) {
    return NextResponse.json(
      { error: "Only registered invoices can be cancelled" },
      { status: 400 }
    )
  }
  if (hasIssuedReceipt(invoice)) {
    return NextResponse.json(
      { error: "Invoices with an issued receipt cannot be cancelled" },
      { status: 409 }
    )
  }

  const reason = isCancellationReason(body.reason)
    ? body.reason
    : DEFAULT_CANCELLATION_REASON
  const reasonCode = cancellationReasonCode(reason)
  const remark = typeof body.remark === "string" ? body.remark.trim() : ""

  const businessId = invoice.businessId
  const payload = {
    Irn: invoice.irn,
    ReasonCode: reasonCode,
    Remark: remark,
  }

  try {
    const cfg = await getConfig(businessId)
    const result = await callEims("/v1/cancel", payload, businessId, {
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
          cancellationReason: reason,
          cancellationRemark: remark || null,
          cancellationError: Prisma.DbNull,
          cancelledAt:
            parseCancellationDate(data?.body?.cancellationDate) ?? new Date(),
        },
      })
      return NextResponse.json({
        ok: true,
        cancelledAt: data?.body?.cancellationDate ?? null,
      })
    }

    // Idempotency: EIMS may already have this IRN cancelled (e.g. a previous
    // request was accepted but our local update failed). Reconcile the local
    // state instead of surfacing a confusing "Processing_Error".
    const errorMessage = extractErrorMessage(result.data)
    if (/already\s*cancel(?:ed|led)?/i.test(errorMessage)) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          registrationStatus: "CANCELLED",
          registrationError: Prisma.DbNull,
          cancellationReason: reason,
          cancellationRemark: remark || null,
          cancellationError: Prisma.DbNull,
          cancelledAt: new Date(),
        },
      })
      return NextResponse.json({ ok: true, alreadyCancelled: true })
    }

    const eims = parseEimsError(data)
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        cancellationError: {
          statusCode: eims.statusCode,
          message: eims.message,
          issues: eims.issues,
          raw: (result.data ?? null) as Prisma.InputJsonValue,
        },
      },
    })
    return NextResponse.json(
      {
        error: errorMessage,
        detail: result.data ?? null,
      },
      { status: result.ok ? 500 : result.status }
    )
  } catch (err) {
    if (isEimsAuthError(err)) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          statusCode: 502,
          detail: { eimsStatusCode: err.eimsStatusCode },
        },
        { status: 502 }
      )
    }
    const message =
      err instanceof Error ? err.message : "EIMS cancellation failed"
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { cancellationError: { statusCode: null, message, issues: [] } },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
