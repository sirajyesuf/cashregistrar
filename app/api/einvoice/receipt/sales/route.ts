import { NextResponse } from "next/server"
import { Prisma, type Invoice } from "@prisma/client"
import { getSessionUser } from "@/lib/auth/user"
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
import {
  canAccessInvoice,
  eimsCounterKey,
  getWorkspace,
} from "@/lib/workspace"

export const runtime = "nodejs"

/**
 * Issues a Sales Receipt on EIMS for a registered invoice.
 *
 * Like invoice registration, receipts carry a sequential ReceiptCounter per
 * source system (tracked by the "eims_receipt" Counter row) which can drift
 * behind EIMS. The same self-heal applies: on a 7001/7015 sequence error the
 * counter is realigned to EIMS's expected value and the request is retried
 * once.
 *
 * One receipt per invoice (Receipt.invoiceId is unique). Issuing a receipt
 * over an invoice that already has an ISSUED receipt returns the existing RRN.
 */
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

/**
 * Retries an async operation a few times to ride out transient database
 * failures (the only realistic cause of "EIMS accepted but we failed to
 * persist"). Throws the last error if all attempts fail.
 */
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
    include: { receipt: true },
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
      { error: "Only registered invoices can receive a receipt" },
      { status: 400 }
    )
  }

  if (invoice.receipt?.status === "ISSUED") {
    return NextResponse.json({
      ok: true,
      rrn: invoice.receipt.rrn,
      qr: invoice.receipt.qr,
      status: invoice.receipt.eimsStatus,
    })
  }

  const businessId = invoice.businessId
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
    // EIMS accepted the receipt, consuming `receiptNumber`. Persist the receipt
    // and advance the counter atomically so the number can never be reused.
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
      // EIMS consumed the number but we could not record the receipt. Advance
      // the counter anyway so a retry never reuses the consumed number (which
      // would surface as a confusing 406 "already has a receipt"). The receipt
      // for this invoice is unrecoverable: EIMS will not issue twice for the
      // same IRN.
      try {
        await prisma.counter.update({
          where: { businessId_branchId_name: counterKey },
          data: { value: { increment: 1 } },
        })
      } catch {
        // best effort; nothing else we can do
      }
      return NextResponse.json(
        {
          error:
            "Receipt was issued on EIMS but could not be saved locally. " +
            "Do not retry this invoice - the receipt is already registered.",
        },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true, rrn, qr, status: eimsStatus })
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
  return NextResponse.json(
    { error: message },
    { status: result.ok ? 500 : result.status }
  )
}
