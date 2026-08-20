import { prisma } from "@/lib/db"
import { callEims, type EimsCallResult } from "@/lib/einvoice/client"
import { getConfig } from "@/lib/einvoice/config"
import { getBusinessAccess } from "@/lib/business"
import {
  isEimsAuthError,
  parseEimsError,
  rateLimitMessage,
  retryAfterSeconds,
} from "@/lib/einvoice/eims-error"
import {
  requireInvoiceAccess,
  type EimsServiceResult,
} from "@/lib/einvoice/access"

/**
 * EIMS invoice verification (`POST /v1/verify`).
 *
 * Given an Invoice Reference Number (IRN), the Ethiopian tax authority returns
 * the full registered invoice exactly as it is stored on EIMS. This lets us:
 *
 *   - prove an invoice is genuinely registered with the authority (compliance),
 *   - check an IRN a customer scans against both EIMS and our own records,
 *   - surface local state that has drifted from EIMS (e.g. a locally-failed
 *     invoice that EIMS actually registered).
 *
 * The endpoint is deliberately read-only: verification never mutates local
 * invoices. Mismatches are reported in `localMatch` so callers (the UI, public
 * API consumers) can decide what to do.
 */

export const IRN_PATTERN = /^[0-9a-fA-F]{64}$/

export function isValidIrn(value: string): boolean {
  return IRN_PATTERN.test(value.trim())
}

/** A normalized, typed view of the EIMS verification payload. */
export type VerifiedInvoice = {
  irn: string
  transactionType: string | null
  documentType: string | null
  documentNumber: string | null
  documentDate: string | null
  totalValue: number | null
  taxValue: number | null
  exciseValue: number | null
  invoiceCurrency: string | null
  exchangeRate: number | null
  sellerTin: string | null
  sellerLegalName: string | null
  buyerTin: string | null
  buyerLegalName: string | null
  itemCount: number
}

/** How the verified IRN relates to a local invoice in the same business. */
export type VerifyLocalMatch = {
  id: string
  number: string
  registrationStatus: string | null
  branchId: string
  status: "MATCHED" | "STATUS_MISMATCH"
}

function toStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Interprets the EIMS `body.body` envelope. Returns null when the payload does
 * not describe a registered invoice (e.g. an error envelope without an Irn).
 */
export function parseVerifiedInvoice(
  envelopeBody: unknown
): VerifiedInvoice | null {
  if (!envelopeBody || typeof envelopeBody !== "object") return null
  const b = envelopeBody as {
    Irn?: unknown
    TransactionType?: unknown
    DocumentDetails?: { Type?: unknown; DocumentNumber?: unknown; Date?: unknown }
    ValueDetails?: {
      TotalValue?: unknown
      TaxValue?: unknown
      ExciseValue?: unknown
      InvoiceCurrency?: unknown
      ExchangeRate?: unknown
    }
    SellerDetails?: { Tin?: unknown; LegalName?: unknown }
    BuyerDetails?: { Tin?: unknown; LegalName?: unknown }
    ItemList?: unknown
  }

  const irn = toStr(b.Irn)
  if (!irn) return null

  return {
    irn,
    transactionType: toStr(b.TransactionType),
    documentType: toStr(b.DocumentDetails?.Type),
    documentNumber: toStr(b.DocumentDetails?.DocumentNumber),
    documentDate: toStr(b.DocumentDetails?.Date),
    totalValue: toNumber(b.ValueDetails?.TotalValue),
    taxValue: toNumber(b.ValueDetails?.TaxValue),
    exciseValue: toNumber(b.ValueDetails?.ExciseValue),
    invoiceCurrency: toStr(b.ValueDetails?.InvoiceCurrency),
    exchangeRate: toNumber(b.ValueDetails?.ExchangeRate),
    sellerTin: toStr(b.SellerDetails?.Tin),
    sellerLegalName: toStr(b.SellerDetails?.LegalName),
    buyerTin: toStr(b.BuyerDetails?.Tin),
    buyerLegalName: toStr(b.BuyerDetails?.LegalName),
    itemCount: Array.isArray(b.ItemList) ? b.ItemList.length : 0,
  }
}

/** Finds a local invoice carrying the given IRN within a business. */
async function findLocalMatch(
  businessId: string,
  irn: string
): Promise<VerifyLocalMatch | null> {
  const local = await prisma.invoice.findFirst({
    where: { irn, businessId },
    select: {
      id: true,
      number: true,
      registrationStatus: true,
      branchId: true,
    },
  })
  if (!local) return null
  return {
    id: local.id,
    number: local.number,
    registrationStatus: local.registrationStatus,
    branchId: local.branchId,
    status:
      local.registrationStatus === "REGISTERED" ? "MATCHED" : "STATUS_MISMATCH",
  }
}

/**
 * Verifies an arbitrary IRN against EIMS. The caller must be a member of the
 * business (a verified IRN that matches a local invoice could reveal invoice
 * metadata, so verify-by-IRN is gated on business access rather than being an
 * open query).
 */
export async function verifyByIrn(
  userId: string,
  businessId: string,
  irnInput: string
): Promise<EimsServiceResult> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access) {
    return { status: 403, body: { error: "Forbidden" } }
  }

  const irn = irnInput.trim().toLowerCase()
  if (!isValidIrn(irn)) {
    return {
      status: 400,
      body: {
        error: "IRN must be a 64-character hexadecimal string",
        code: "INVALID_IRN",
      },
    }
  }

  let result: EimsCallResult
  try {
    const cfg = await getConfig(businessId)
    result = await callEims("/v1/verify", { irn }, businessId, {
      TIN: cfg.tin,
      SYSTEM_NUMBER: cfg.systemNumber,
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
    return {
      status: 500,
      body: {
        error:
          err instanceof Error ? err.message : "EIMS verification failed",
      },
    }
  }

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

  const envelope = result.data as
    | { statusCode?: unknown; message?: unknown; body?: unknown }
    | undefined
  const verified = parseVerifiedInvoice(envelope?.body)

  if (result.ok && verified) {
    const localMatch = await findLocalMatch(businessId, verified.irn)
    return {
      status: 200,
      body: {
        ok: true,
        irn: verified.irn,
        status: "ACTIVE",
        verified,
        localMatch,
      },
    }
  }

  // EIMS rejected the IRN (e.g. "VERIFICATION ERROR / Invoice is not
  // registered") or the response was not a registered invoice.
  const eims = parseEimsError(result.data)
  const notRegistered = /not\s*(?:registered|found)|VERIFICATION\s*ERROR/i.test(
    `${eims.message} ${eims.raw}`
  )
  return {
    status: notRegistered ? 404 : result.ok ? 500 : result.status,
    body: {
      ok: false,
      code: notRegistered ? "NOT_REGISTERED" : "EIMS_REJECTED",
      error: notRegistered
        ? "Invoice is not registered on EIMS"
        : eims.raw || eims.message,
      statusCode: eims.statusCode,
      message: eims.message,
      issues: eims.issues,
      detail: result.data ?? null,
      irn,
    },
  }
}

/**
 * Verifies a local invoice (by its stored IRN) against EIMS. Enforces the same
 * branch-level access rules as register/cancel/receipt so a workspace-scoped
 * session cannot probe invoices outside its branch.
 */
export async function verifyLocalInvoice(
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
  if (!access.invoice.irn) {
    return {
      status: 400,
      body: {
        error: "This invoice has no IRN yet — register it with EIMS first",
        code: "NO_IRN",
      },
    }
  }
  return verifyByIrn(userId, businessId, access.invoice.irn)
}