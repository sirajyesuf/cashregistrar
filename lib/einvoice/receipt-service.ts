import { Prisma, type Invoice } from "@prisma/client"
import { prisma } from "@/lib/db"
import { callEims, type EimsCallResult } from "@/lib/einvoice/client"
import { getConfig, type EimsConfig } from "@/lib/einvoice/config"
import { buildSalesReceiptPayload } from "@/lib/einvoice/receipt"
import {
  extractErrorMessage,
  isEimsAuthError,
  isSequenceError,
  parseExpectedCounter,
} from "@/lib/einvoice/eims-error"
import { eimsCounterKey } from "@/lib/workspace"
import {
  requireInvoiceAccess,
  type EimsServiceResult,
} from "@/lib/einvoice/access"

async function attemptReceipt(
  cfg: EimsConfig,
  businessId: string,
  invoice: Invoice,
  counterValue: number
): Promise<{ result: EimsCallResult; receiptNumber: string }> {
  const payload = buildSalesReceiptPayload({
    invoice,
    receiptCounter: counterValue,
    cfg,
  })
  const result = await callEims("/v1/receipt/sales", payload, businessId, {
    TIN: cfg.tin,
    SYSTEM_NUMBER: cfg.systemNumber,
  })
  const receiptNumber = `REC${String(counterValue).padStart(15, "0")}`
  return { result, receiptNumber }
}

/** Retries an async operation a few times to ride out transient DB failures. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }
  }
  throw lastErr
}

export async function issueSalesReceipt(
  userId: string,
  businessId: string,
  invoiceId: string,
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
      body: { error: "Only registered invoices can receive a receipt" },
    }
  }

  if (invoice.receipt?.status === "ISSUED") {
    return {
      status: 200,
      body: {
        ok: true,
        rrn: invoice.receipt.rrn,
        qr: invoice.receipt.qr,
        status: invoice.receipt.eimsStatus,
      },
    }
  }

  const counterKey = { ...eimsCounterKey(businessId), name: "eims_receipt" }
  const counter = await prisma.counter.upsert({
    where: { businessId_branchId_name: counterKey },
    create: { ...counterKey, value: 1 },
    update: {},
  })

  let result: EimsCallResult
  let receiptNumber = ""
  try {
    const cfg = await getConfig(businessId)
    const first = await attemptReceipt(cfg, businessId, invoice, counter.value)
    result = first.result
    receiptNumber = first.receiptNumber

    // Self-heal: realign the receipt counter to EIMS's expected value and retry once.
    if (!result.ok) {
      const message = extractErrorMessage(result.data)
      const expected = parseExpectedCounter(message)
      if (isSequenceError(message) && expected !== null) {
        await prisma.counter.update({
          where: { businessId_branchId_name: counterKey },
          data: { value: expected },
        })
        const retried = await attemptReceipt(cfg, businessId, invoice, expected)
        result = retried.result
        receiptNumber = retried.receiptNumber
      }
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
    throw err
  }

  const data = result.data as
    { body?: { rrn?: unknown; qr?: unknown; status?: unknown } } | undefined
  const rrn = typeof data?.body?.rrn === "string" ? data.body.rrn : null
  const qr = typeof data?.body?.qr === "string" ? data.body.qr : null
  const eimsStatus =
    typeof data?.body?.status === "string" ? data.body.status : null
  const collectedAmount = new Prisma.Decimal(Number(invoice.grandTotal))

  if (result.ok && rrn) {
    try {
      await withRetry(async () => {
        await prisma.$transaction([
          prisma.receipt.upsert({
            where: { invoiceId: invoice.id },
            create: {
              invoiceId: invoice.id,
              number: receiptNumber,
              rrn,
              qr,
              eimsStatus,
              date: new Date(),
              status: "ISSUED",
              error: null,
              collectedAmount,
            },
            update: {
              number: receiptNumber,
              rrn,
              qr,
              eimsStatus,
              date: new Date(),
              status: "ISSUED",
              error: null,
              collectedAmount,
            },
          }),
          prisma.counter.update({
            where: { businessId_branchId_name: counterKey },
            data: { value: { increment: 1 } },
          }),
        ])
      })
    } catch {
      try {
        await prisma.counter.update({
          where: { businessId_branchId_name: counterKey },
          data: { value: { increment: 1 } },
        })
      } catch {
        // best effort; nothing else we can do
      }
      return {
        status: 500,
        body: {
          error:
            "Receipt was issued on EIMS but could not be saved locally. " +
            "Do not retry this invoice - the receipt is already registered.",
        },
      }
    }
    return { status: 200, body: { ok: true, rrn, qr, status: eimsStatus } }
  }

  const rawMessage = extractErrorMessage(data)
  const message = /NOT_ACCEPTABLE|already/i.test(rawMessage)
    ? `${rawMessage} - the invoice may already have a receipt on EIMS.`
    : rawMessage
  try {
    await prisma.receipt.upsert({
      where: { invoiceId: invoice.id },
      create: {
        invoiceId: invoice.id,
        number: receiptNumber,
        status: "FAILED",
        error: message,
      },
      update: {
        number: receiptNumber,
        status: "FAILED",
        error: message,
      },
    })
  } catch {
    // best effort; surface the EIMS error regardless
  }
  return {
    status: result.ok ? 500 : result.status,
    body: { error: message },
  }
}
