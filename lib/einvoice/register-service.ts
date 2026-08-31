import { Prisma } from "@prisma/client"
import type { Invoice, InvoiceLine } from "@prisma/client"
import { prisma } from "@/lib/db"
import { callEims, type EimsCallResult } from "@/lib/einvoice/client"
import { getConfig, type EimsConfig } from "@/lib/einvoice/config"
import {
  buildRegisterPayload,
  buildSellerDetailsFromInvoice,
} from "@/lib/einvoice/payload"
import { validateLineTotals } from "@/lib/einvoice/validate"
import { isEimsBuyerIdType } from "@/lib/einvoice/buyer"
import { isBlankBuyer } from "@/lib/invoice"
import {
  extractErrorMessage,
  isEimsAuthError,
  isSequenceError,
  parseEimsError,
  parseExpectedCounter,
  rateLimitMessage,
  retryAfterSeconds,
} from "@/lib/einvoice/eims-error"
import { eimsCounterKey } from "@/lib/workspace"
import {
  requireInvoiceAccess,
  type EimsServiceResult,
} from "@/lib/einvoice/access"

/**
 * Builds the register payload for a given counter value and sends it to EIMS.
 * Extracted so the self-heal path can re-run the same request with the
 * corrected document number.
 */
async function attemptRegister(
  cfg: EimsConfig,
  businessId: string,
  invoice: Invoice & { lines: InvoiceLine[] },
  counterValue: number,
  previousIrn: string | null
): Promise<EimsCallResult> {
  const payload = buildRegisterPayload({
    invoice,
    sellerDetails: buildSellerDetailsFromInvoice(invoice, cfg),
    invoiceCounter: counterValue,
    previousIrn,
    cfg,
  })
  return callEims("/v1/register", payload, businessId, {
    TIN: cfg.tin,
    SYSTEM_NUMBER: cfg.systemNumber,
  })
}

export async function registerInvoice(
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

  if (invoice.registrationStatus === "REGISTERED") {
    return { status: 200, body: { ok: true, irn: invoice.irn } }
  }

  if (invoice.transactionType === "B2B" && !invoice.buyerTin) {
    return { status: 400, body: { error: "B2B invoices require a buyer TIN" } }
  }

  if (
    invoice.transactionType === "B2C" &&
    !isBlankBuyer({
      legalName: invoice.buyerLegalName,
      tin: invoice.buyerTin,
      vatNumber: invoice.buyerVatNumber,
      email: invoice.buyerEmail,
      phone: invoice.buyerPhone,
      idNumber: invoice.buyerIdNumber,
    }) &&
    !isEimsBuyerIdType(invoice.buyerIdType)
  ) {
    return {
      status: 400,
      body: {
        error:
          "B2C buyers with details require a valid ID type (NID, KID, SID, WID, PST, DLS, MRS)",
      },
    }
  }

  if (invoice.lines.some((line) => line.description.trim().length < 3)) {
    return {
      status: 400,
      body: {
        error:
          "Every line item description must be at least 3 characters (required by EIMS)",
      },
    }
  }

  const lineTotalIssues = validateLineTotals({
    lines: invoice.lines,
    taxCode: invoice.taxCode,
    taxRate: Number(invoice.taxRate),
  })
  if (lineTotalIssues.length > 0) {
    return {
      status: 400,
      body: {
        error:
          lineTotalIssues
            .map(
              (issue) =>
                `Line ${issue.lineNumber}: TotalLineAmount should be ${issue.expected.toFixed(
                  2
                )} but is ${issue.received.toFixed(2)}`
            )
            .join("; ") +
          ". This usually means the invoice tax rate does not match the selected tax code. " +
          "Edit the invoice and set the tax rate to match the tax code, or fix the line totals.",
      },
    }
  }

  const counterKey = { ...eimsCounterKey(businessId), name: "eims" }
  const counter = await prisma.counter.upsert({
    where: { businessId_branchId_name: counterKey },
    create: { ...counterKey, value: 1 },
    update: {},
  })
  const previous = await prisma.invoice.findFirst({
    where: {
      irn: { not: null },
      registrationStatus: "REGISTERED",
      id: { not: invoice.id },
      businessId,
    },
    orderBy: { createdAt: "desc" },
    select: { irn: true },
  })
  const previousIrn = previous?.irn ?? null

  let result: EimsCallResult
  try {
    const cfg = await getConfig(businessId)
    result = await attemptRegister(
      cfg,
      businessId,
      invoice,
      counter.value,
      previousIrn
    )

    // Self-heal: realign the counter to EIMS's expected next number and retry once.
    if (!result.ok) {
      const message = extractErrorMessage(result.data)
      const expected = parseExpectedCounter(message)
      if (isSequenceError(message) && expected !== null) {
        await prisma.counter.update({
          where: { businessId_branchId_name: counterKey },
          data: { value: expected },
        })
        result = await attemptRegister(
          cfg,
          businessId,
          invoice,
          expected,
          previousIrn
        )
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

  const data = result.data as { body?: { irn?: unknown } } | undefined
  const irn = typeof data?.body?.irn === "string" ? data.body.irn : null

  if (result.status === 429) {
    return {
      status: 429,
      body: {
        error: rateLimitMessage(result.retryAfter),
        statusCode: 429,
        retryAfter: result.retryAfter,
        retryAfterSeconds: retryAfterSeconds(result.retryAfter),
      },
    }
  }

  if (result.ok && irn) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        irn,
        registrationStatus: "REGISTERED",
        registrationError: Prisma.DbNull,
        registeredAt: new Date(),
      },
    })
    await prisma.counter.update({
      where: { businessId_branchId_name: counterKey },
      data: { value: { increment: 1 } },
    })
    return { status: 200, body: { ok: true, irn } }
  }

  const eims = parseEimsError(data)
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      registrationStatus: "FAILED",
      registrationError: {
        statusCode: eims.statusCode,
        message: eims.message,
        issues: eims.issues,
      },
    },
  })
  return {
    status: result.ok ? 500 : result.status,
    body: {
      error: eims.raw,
      statusCode: eims.statusCode,
      message: eims.message,
      issues: eims.issues,
      detail: eims.raw,
    },
  }
}
