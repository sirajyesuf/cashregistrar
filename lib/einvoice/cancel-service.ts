import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { callEims } from "@/lib/einvoice/client"
import { getConfig } from "@/lib/einvoice/config"
import {
  cancellationReasonCode,
  DEFAULT_CANCELLATION_REASON,
  isCancellationReason,
} from "@/lib/einvoice/cancellation-reason"
import { parseCancellationDate } from "@/lib/einvoice/cancellation-date"
import { isEimsAuthError, parseEimsError } from "@/lib/einvoice/eims-error"
import { hasIssuedReceipt } from "@/lib/invoice"
import {
  requireInvoiceAccess,
  type EimsServiceResult,
} from "@/lib/einvoice/access"

export type CancelInput = { reason?: unknown; remark?: unknown }

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

export async function cancelInvoice(
  userId: string,
  businessId: string,
  invoiceId: string,
  input: CancelInput,
  scopeBranchId?: string
): Promise<EimsServiceResult> {
  const access = await requireInvoiceAccess(
    userId,
    businessId,
    invoiceId,
    scopeBranchId
  )
  if (!access.ok) return { status: access.status, body: access.body }
  const invoice = access.invoice

  if (invoice.registrationStatus !== "REGISTERED" || !invoice.irn) {
    return {
      status: 400,
      body: { error: "Only registered invoices can be cancelled" },
    }
  }
  if (hasIssuedReceipt(invoice)) {
    return {
      status: 409,
      body: { error: "Invoices with an issued receipt cannot be cancelled" },
    }
  }

  const reason = isCancellationReason(input.reason)
    ? input.reason
    : DEFAULT_CANCELLATION_REASON
  const reasonCode = cancellationReasonCode(reason)
  const remark = typeof input.remark === "string" ? input.remark.trim() : ""

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
      return {
        status: 200,
        body: { ok: true, cancelledAt: data?.body?.cancellationDate ?? null },
      }
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
      return { status: 200, body: { ok: true, alreadyCancelled: true } }
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
    return {
      status: result.ok ? 500 : result.status,
      body: { error: errorMessage, detail: result.data ?? null },
    }
  } catch (err) {
    if (isEimsAuthError(err)) {
      return {
        status: 502,
        body: {
          error: err.message,
          code: err.code,
          statusCode: 502,
          detail: { eimsStatusCode: err.eimsStatusCode },
        },
      }
    }
    const message =
      err instanceof Error ? err.message : "EIMS cancellation failed"
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { cancellationError: { statusCode: null, message, issues: [] } },
    })
    return { status: 500, body: { error: message } }
  }
}
