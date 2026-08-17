import { Prisma } from "@prisma/client"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db"
import { callEims } from "@/lib/einvoice/client"
import { getConfig, type EimsConfig } from "@/lib/einvoice/config"
import { validateLineTotals } from "@/lib/einvoice/validate"
import {
  extractErrorMessage,
  isEimsAuthError,
  rateLimitMessage,
  retryAfterSeconds,
} from "@/lib/einvoice/eims-error"
import {
  cancellationReasonCode,
  DEFAULT_CANCELLATION_REASON,
  isCancellationReason,
} from "@/lib/einvoice/cancellation-reason"
import { hasIssuedReceipt } from "@/lib/invoice"
import {
  getBusinessAccess,
  accessibleBranchWhere,
} from "@/lib/business"
import {
  submitBulkRegistration,
  type SubmitBulkOutcome,
} from "@/lib/einvoice/bulk-submit"
import type { EimsServiceResult } from "@/lib/einvoice/access"

export type BulkCancelInput = { reason?: unknown; remark?: unknown }

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function cancelResultEntries(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    )
  }
  const root =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null
  const body = root?.body
  if (Array.isArray(body)) {
    return body.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    )
  }
  return []
}

function cancelResultSuccess(entry: Record<string, unknown>): boolean {
  const status = text(entry.status)?.toUpperCase()
  if (status === "C" || status === "CANCELLED") return true

  const msg = text(entry.msg)
  if (msg && /already\s*cancel(?:ed|led)?/i.test(msg)) return true
  return false
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export async function bulkRegister(
  userId: string,
  businessId: string,
  invoiceIds: string[],
  scopeBranchId?: string
): Promise<EimsServiceResult> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access)
    return { status: 404, body: { error: "Business not found" } }

  const where = {
    id: { in: invoiceIds },
    businessId,
    ...accessibleBranchWhere(access, scopeBranchId),
  }
  const invoices = await prisma.invoice.findMany({
    where,
    include: { lines: true },
  })
  if (invoices.length !== invoiceIds.length)
    return { status: 404, body: { error: "One or more invoices were not found" } }

  for (const invoice of invoices) {
    if (
      invoice.registrationStatus === "REGISTERED" ||
      invoice.registrationStatus === "CANCELLED"
    ) {
      return {
        status: 409,
        body: { error: `Invoice ${invoice.number} cannot be registered` },
      }
    }
    if (invoice.transactionType === "B2B" && !invoice.buyerTin) {
      return {
        status: 400,
        body: { error: `Invoice ${invoice.number} requires a buyer TIN` },
      }
    }
    if (invoice.lines.some((line) => line.description.trim().length < 3)) {
      return {
        status: 400,
        body: { error: `Invoice ${invoice.number} has an invalid line description` },
      }
    }
    const issues = validateLineTotals({
      lines: invoice.lines,
      taxCode: invoice.taxCode,
      taxRate: Number(invoice.taxRate),
    })
    if (issues.length > 0)
      return {
        status: 400,
        body: { error: `Invoice ${invoice.number} has invalid line totals` },
      }
  }

  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const orderedInvoices = invoiceIds.map((id) => byId.get(id)!)

  let cfg: EimsConfig
  try {
    cfg = await getConfig(businessId)
  } catch (err) {
    if (isEimsAuthError(err)) {
      return {
        status: 502,
        body: { error: err.message, code: err.code, statusCode: 502 },
      }
    }
    throw err
  }

  const previous = await prisma.invoice.findFirst({
    where: { irn: { not: null }, registrationStatus: "REGISTERED", businessId },
    orderBy: { registeredAt: "desc" },
    select: { irn: true },
  })

  let outcome: SubmitBulkOutcome
  try {
    outcome = await submitBulkRegistration({
      businessId,
      invoices: orderedInvoices,
      cfg,
      previousIrn: previous?.irn ?? null,
      retryCount: 0,
    })
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
    throw err
  }

  if (!outcome.ok) {
    const message =
      outcome.status === 429
        ? rateLimitMessage(outcome.retryAfter)
        : outcome.error
    return {
      status: outcome.status,
      body: {
        error: message,
        statusCode: outcome.status,
        retryAfter: outcome.retryAfter,
        retryAfterSeconds: retryAfterSeconds(outcome.retryAfter),
        detail: outcome.detail,
      },
    }
  }

  return {
    status: 202,
    body: {
      ok: true,
      operationId: outcome.operationId,
      conversationId: outcome.conversationId,
      count: outcome.count,
    },
  }
}

export async function bulkCancel(
  userId: string,
  businessId: string,
  invoiceIds: string[],
  input: BulkCancelInput,
  scopeBranchId?: string
): Promise<EimsServiceResult> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access)
    return { status: 404, body: { error: "Business not found" } }

  const where = {
    id: { in: invoiceIds },
    businessId,
    ...accessibleBranchWhere(access, scopeBranchId),
  }
  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      id: true,
      number: true,
      irn: true,
      businessId: true,
      registrationStatus: true,
      receipt: { select: { status: true } },
    },
  })
  if (invoices.length !== invoiceIds.length)
    return { status: 404, body: { error: "One or more invoices were not found" } }

  for (const invoice of invoices) {
    if (invoice.registrationStatus !== "REGISTERED" || !invoice.irn)
      return {
        status: 400,
        body: { error: `Invoice ${invoice.number} is not registered` },
      }
    if (hasIssuedReceipt(invoice))
      return {
        status: 409,
        body: { error: `Invoice ${invoice.number} has an issued receipt` },
      }
  }

  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const orderedInvoices = invoiceIds.map((id) => byId.get(id)!)
  const reason = isCancellationReason(input.reason)
    ? input.reason
    : DEFAULT_CANCELLATION_REASON
  const reasonCode = cancellationReasonCode(reason)
  const remark = typeof input.remark === "string" ? input.remark.trim() : ""

  try {
    const cfg = await getConfig(businessId)
    const result = await callEims(
      "/v1/bulkCancel",
      orderedInvoices.map((invoice) => ({
        Irn: invoice.irn!,
        ReasonCode: reasonCode,
        Remark: remark,
      })),
      businessId,
      {
        TIN: cfg.tin,
        SYSTEM_NUMBER: cfg.systemNumber,
      }
    )
    if (!result.ok) {
      const message = extractErrorMessage(result.data)
      return {
        status: result.status,
        body: {
          error: message,
          statusCode: result.status,
          retryAfter: result.retryAfter,
          detail: result.data,
        },
      }
    }

    const entries = cancelResultEntries(result.data)

    const byIrn = new Map(
      orderedInvoices.map((invoice) => [invoice.irn, invoice])
    )
    const outcomes = entries.map((entry, index) => {
      const irn = text(entry.Irn) ?? text(entry.irn)
      const positional = orderedInvoices[index]
      const irnMatch = irn ? byIrn.get(irn) : undefined
      const invoice = irnMatch ?? positional
      return {
        entry,
        irn,
        invoice,
        success: Boolean(invoice) && cancelResultSuccess(entry),
      }
    })

    if (outcomes.length === 0) {
      return {
        status: 502,
        body: {
          error: "EIMS returned no matching cancellation results",
          detail: result.data,
        },
      }
    }

    const succeeded = outcomes.filter((o) => o.success).length
    const failed = outcomes.length - succeeded

    const operation = await prisma.$transaction(async (tx) => {
      const op = await tx.eimsOperation.create({
        data: {
          conversationId: `cancel-${Date.now()}-${randomUUID()}`,
          businessId,
          type: "CANCEL",
          status: "PROCESSING",
          rawResponse: asJson(result.data),
          items: {
            create: orderedInvoices.map((invoice) => {
              const outcome = outcomes.find((o) => o.invoice?.id === invoice.id)
              return {
                invoiceId: invoice.id,
                irn: invoice.irn!,
                status: outcome?.success ? "SUCCEEDED" : "FAILED",
                error:
                  outcome && !outcome.success
                    ? asJson(outcome.entry)
                    : Prisma.DbNull,
                rawResult: outcome ? asJson(outcome.entry) : Prisma.DbNull,
              }
            }),
          },
        },
      })
      for (const outcome of outcomes) {
        if (!outcome.invoice) continue
        await tx.invoice.update({
          where: { id: outcome.invoice.id },
          data: outcome.success
            ? {
                registrationStatus: "CANCELLED",
                registrationError: Prisma.DbNull,
                cancellationReason: reason,
                cancellationRemark: remark || null,
                cancellationError: Prisma.DbNull,
                cancelledAt: new Date(),
              }
            : { cancellationError: asJson(outcome.entry) },
        })
      }
      const status =
        succeeded > 0 && failed > 0
          ? "PARTIAL"
          : succeeded > 0
            ? "COMPLETED"
            : "FAILED"
      await tx.eimsOperation.update({
        where: { id: op.id },
        data: { status, completedAt: new Date() },
      })
      return op
    })

    return {
      status: 200,
      body: {
        ok: true,
        operationId: operation.id,
        count: outcomes.length,
        succeeded,
        failed,
      },
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
      err instanceof Error ? err.message : "Bulk cancellation failed"
    return { status: 500, body: { error: message } }
  }
}
