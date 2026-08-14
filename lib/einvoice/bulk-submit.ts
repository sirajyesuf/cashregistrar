import { Prisma } from "@prisma/client"
import type { Invoice, InvoiceLine } from "@prisma/client"
import { prisma } from "@/lib/db"
import { callEims, type EimsCallResult } from "@/lib/einvoice/client"
import type { EimsConfig } from "@/lib/einvoice/config"
import {
  buildRegisterPayload,
  buildSellerDetailsFromInvoice,
} from "@/lib/einvoice/payload"
import {
  extractErrorMessage,
  isEimsAuthError,
  isSequenceError,
  parseExpectedCounter,
} from "@/lib/einvoice/eims-error"
import { eimsCounterKey } from "@/lib/workspace"
import {
  getCallbackHeaders,
  parseBulkOperationResponse,
} from "@/lib/einvoice/operation"

export type SubmitBulkParams = {
  businessId: string
  invoices: (Invoice & { lines: InvoiceLine[] })[]
  cfg: EimsConfig
  previousIrn: string | null
  retryCount: number
  /** Forces the first document number (and counter) instead of reserving the
   *  current counter. Used by the callback auto-resubmit, which already knows
   *  EIMS's expected next number from the sequence error. */
  startCounter?: number
}

export type SubmitBulkOutcome =
  | { ok: true; operationId: string; conversationId: string; count: number }
  | {
      ok: false
      status: number
      error: string
      retryAfter: string | null
      detail: unknown
    }

/**
 * Submits a batch of invoices to EIMS bulk registration and persists the
 * resulting operation. Shared by the bulk-register route (first submission,
 * retryCount 0) and the callback route (auto-resubmit after a sequence error,
 * retryCount + 1).
 *
 * The counter is reserved upfront (increment by batch length) so concurrent
 * submissions never reuse document numbers. On a synchronous 7001/7015
 * sequence error the counter is realigned forward-only and the batch is retried
 * once with the corrected start number. `EimsAuthError` propagates to the
 * caller; everything else is returned as a structured outcome.
 */
export async function submitBulkRegistration(
  params: SubmitBulkParams
): Promise<SubmitBulkOutcome> {
  const { businessId, invoices, cfg, previousIrn, retryCount } = params
  const counterKey = { ...eimsCounterKey(businessId), name: "eims" }

  if (invoices.length === 0) {
    return { ok: false, status: 400, error: "No invoices to submit", retryAfter: null, detail: null }
  }

  const attemptBulk = async (startCounter: number): Promise<EimsCallResult> => {
    const payload = invoices.map((invoice, index) =>
      buildRegisterPayload({
        invoice,
        sellerDetails: buildSellerDetailsFromInvoice(invoice, cfg),
        invoiceCounter: startCounter + index,
        previousIrn: index === 0 ? previousIrn : null,
        cfg,
      })
    )
    return callEims("/v1/bulkRegister", payload, businessId, {
      TIN: cfg.tin,
      SYSTEM_NUMBER: cfg.systemNumber,
      ...getCallbackHeaders(),
    })
  }

  const reserveRange = async (tx: Prisma.TransactionClient) => {
    const counter = await tx.counter.upsert({
      where: { businessId_branchId_name: counterKey },
      create: { ...counterKey, value: 1 },
      update: {},
    })
    await tx.counter.update({
      where: { businessId_branchId_name: counterKey },
      data: { value: { increment: invoices.length } },
    })
    return counter.value
  }

  let startCounter = 0
  let result: EimsCallResult
  try {
    if (params.startCounter != null) {
      startCounter = params.startCounter
      await prisma.counter.upsert({
        where: { businessId_branchId_name: counterKey },
        create: { ...counterKey, value: startCounter + invoices.length },
        update: { value: startCounter + invoices.length },
      })
    } else {
      startCounter = await prisma.$transaction(reserveRange)
    }
    result = await attemptBulk(startCounter)

    // Self-heal: realign the counter to EIMS's expected next number and retry
    // once. On the retry we consume the same range again, so the counter must
    // end at expected + batch length. EIMS's expected number is authoritative
    // here, so the counter is set unconditionally (it may legitimately move
    // backward when we previously over-reserved numbers).
    if (!result.ok) {
      const message = extractErrorMessage(result.data)
      const expected = parseExpectedCounter(message)
      if (isSequenceError(message) && expected !== null) {
        await prisma.counter.update({
          where: { businessId_branchId_name: counterKey },
          data: { value: expected + invoices.length },
        })
        startCounter = expected
        result = await attemptBulk(expected)
      }
    }
  } catch (err) {
    if (isEimsAuthError(err)) throw err
    const message = err instanceof Error ? err.message : "Bulk registration failed"
    return { ok: false, status: 500, error: message, retryAfter: null, detail: null }
  }

  const operationResponse = parseBulkOperationResponse(result.data)
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: extractErrorMessage(result.data),
      retryAfter: result.retryAfter,
      detail: result.data,
    }
  }
  if (!operationResponse) {
    return {
      ok: false,
      status: 502,
      error: "EIMS response did not include a conversationId",
      retryAfter: null,
      detail: result.data,
    }
  }

  const operation = await prisma.eimsOperation.create({
    data: {
      conversationId: operationResponse.conversationId,
      businessId,
      type: "REGISTER",
      retryCount,
      items: {
        create: invoices.map((invoice, index) => ({
          invoiceId: invoice.id,
          documentNumber: String(startCounter + index),
        })),
      },
    },
  })
  await prisma.invoice.updateMany({
    where: { id: { in: invoices.map((invoice) => invoice.id) } },
    data: { registrationStatus: "PROCESSING" },
  })

  return {
    ok: true,
    operationId: operation.id,
    conversationId: operation.conversationId,
    count: invoices.length,
  }
}
