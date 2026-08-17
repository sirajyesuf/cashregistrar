import { Prisma, Role } from "@prisma/client"
import type { Invoice, InvoiceLine, Receipt } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  canAccessBranch,
  getBusinessAccess,
} from "@/lib/business"
import { conflict, notFound, type ServiceResult } from "@/lib/service"
import { sellerSnapshotFromBusiness } from "@/lib/einvoice/payload"
import {
  claimIdempotencyKey,
  clearIdempotencyKey,
  settleIdempotencyKey,
} from "@/lib/idempotency"
import type { InvoiceInput } from "@/lib/invoice-schema"

function centsToDecimal(cents: number) {
  return new Prisma.Decimal(Math.round(cents)).div(100)
}

function buyerData(buyer: InvoiceInput["buyer"]) {
  return {
    buyerLegalName: buyer.legalName,
    buyerTin: buyer.tin,
    buyerVatNumber: buyer.vatNumber,
    buyerIdType: buyer.idType,
    buyerIdNumber: buyer.idNumber,
    buyerEmail: buyer.email,
    buyerPhone: buyer.phone,
    buyerCity: buyer.city,
    buyerRegion: buyer.region,
    buyerCountry: buyer.country,
    buyerZone: buyer.zone,
    buyerKebele: buyer.kebele,
    buyerWereda: buyer.wereda,
    buyerHouseNumber: buyer.houseNumber,
  }
}

function normalizeLines(lines: InvoiceInput["lines"]) {
  return lines.map((line) => ({
    ...line,
    unitPriceCents: Math.round(line.unitPriceCents),
  }))
}

function computeTotals(lines: ReturnType<typeof normalizeLines>, taxRate: number) {
  // Tax is computed per line then summed, mirroring EIMS's per-line rule
  // (round2(preTax * rate)). Computing tax once on the summed subtotal can
  // drift by a cent from EIMS's totals, so we match it line-by-line.
  let subtotalCents = 0
  let taxAmountCents = 0
  for (const line of lines) {
    const preTaxCents = Math.round(line.quantity * line.unitPriceCents)
    subtotalCents += preTaxCents
    taxAmountCents += Math.round(preTaxCents * taxRate)
  }
  const grandTotalCents = subtotalCents + taxAmountCents
  return { subtotalCents, taxAmountCents, grandTotalCents }
}

function lineCreateData(lines: ReturnType<typeof normalizeLines>) {
  return lines.map((line, index) => ({
    lineNumber: index + 1,
    description: line.description,
    quantity: new Prisma.Decimal(line.quantity),
    unitPrice: centsToDecimal(line.unitPriceCents),
    total: centsToDecimal(Math.round(line.quantity * line.unitPriceCents)),
    itemCode: line.itemCode,
    unit: line.unit || "PCS",
  }))
}

export type InvoiceSummary = {
  id: string
  number: string
  date: string
  buyerLegalName: string | null
  taxRate: Prisma.Decimal
  grandTotal: Prisma.Decimal
  irn: string | null
  registrationStatus: Invoice["registrationStatus"]
  createdAt: Date
  receipt: { status: Receipt["status"] } | null
  _count: { lines: number }
}

export type InvoiceListResult = {
  invoices: InvoiceSummary[]
  total: number
  page: number
  pageSize: number
  stats: {
    totalInvoices: number
    failed: number
    cancelled: number
    issuedReceipts: number
  }
}

export async function listInvoices(
  userId: string,
  businessId: string,
  opts: { page?: number; pageSize?: number; branchId?: string | null } = {}
): Promise<ServiceResult<InvoiceListResult>> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access) return notFound("Business not found")

  const page = Math.max(1, opts.page || 1)
  const pageSize = Math.min(50, Math.max(1, opts.pageSize || 10))

  let branchFilter: { branchId?: string }
  if (opts.branchId) {
    if (!canAccessBranch(access, opts.branchId)) {
      return notFound("Branch not found")
    }
    branchFilter = { branchId: opts.branchId }
  } else if (access.role === Role.OWNER) {
    branchFilter = {}
  } else {
    branchFilter = { branchId: access.branchId ?? "__none__" }
  }

  const where = { businessId, ...branchFilter }

  const [invoices, total, failed, cancelled, issuedReceipts] =
    await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          number: true,
          date: true,
          buyerLegalName: true,
          taxRate: true,
          grandTotal: true,
          irn: true,
          registrationStatus: true,
          createdAt: true,
          receipt: { select: { status: true } },
          _count: { select: { lines: true } },
        },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.count({ where: { ...where, registrationStatus: "FAILED" } }),
      prisma.invoice.count({ where: { ...where, registrationStatus: "CANCELLED" } }),
      prisma.receipt.count({
        where: { status: "ISSUED", invoice: { businessId } },
      }),
    ])

  return {
    ok: true,
    data: {
      invoices,
      total,
      page,
      pageSize,
      stats: { totalInvoices: total, failed, cancelled, issuedReceipts },
    },
  }
}

async function sellerSnapshot(businessId: string) {
  const [business, credential] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId } }),
    prisma.morCredential.findUnique({ where: { businessId } }),
  ])
  return sellerSnapshotFromBusiness(business, credential)
}

export async function createInvoice(
  userId: string,
  businessId: string,
  branchId: string,
  input: InvoiceInput,
  opts?: { idempotencyKey?: string }
): Promise<ServiceResult<Invoice & { lines: InvoiceLine[] }>> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access) return notFound("Business not found")
  if (!canAccessBranch(access, branchId)) return notFound("Branch not found")

  const lines = normalizeLines(input.lines)
  const { subtotalCents, taxAmountCents, grandTotalCents } = computeTotals(
    lines,
    input.taxRate
  )
  const snapshot = await sellerSnapshot(businessId)

  let claimedKey: string | null = null
  if (opts?.idempotencyKey) {
    const claim = await claimIdempotencyKey(
      opts.idempotencyKey,
      userId,
      businessId
    )
    if (claim.kind === "replay") {
      const invoice = await prisma.invoice.findFirst({
        where: { id: claim.invoiceId, businessId },
        include: { lines: true },
      })
      if (!invoice) return notFound("Invoice not found")
      return { ok: true, data: invoice }
    }
    if (claim.kind === "busy") {
      return conflict(
        "A request with this idempotency key is already in progress"
      )
    }
    claimedKey = claim.keyHash
  }

  try {
    // Number reservation and invoice insert share a transaction so concurrent
    // creates can never produce the same INV-XXXX number (which would trip the
    // [businessId, branchId, number] unique constraint).
    const invoice = await prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: {
          businessId_branchId_name: { businessId, branchId, name: "invoice" },
        },
        create: { businessId, branchId, name: "invoice", value: 1 },
        update: { value: { increment: 1 } },
      })
      const number = `INV-${String(counter.value).padStart(4, "0")}`

      return tx.invoice.create({
        data: {
          number,
          date: input.date,
          businessId,
          branchId,
          ...snapshot,
          taxCode: input.taxCode,
          taxRate: new Prisma.Decimal(input.taxRate),
          subtotal: centsToDecimal(subtotalCents),
          taxAmount: centsToDecimal(taxAmountCents),
          grandTotal: centsToDecimal(grandTotalCents),
          transactionType: input.transactionType,
          incomeWithholdRate: new Prisma.Decimal(input.incomeWithholdRate),
          cashierName: input.cashierName || "AAA",
          salesPersonName: input.salesPersonName || "AAA",
          ...buyerData(input.buyer),
          userId,
          lines: { create: lineCreateData(lines) },
        },
        include: { lines: true },
      })
    })

    if (claimedKey) await settleIdempotencyKey(claimedKey, invoice.id)
    return { ok: true, data: invoice }
  } catch (error) {
    if (claimedKey) {
      await clearIdempotencyKey(claimedKey).catch(() => {})
    }
    throw error
  }
}

export async function getInvoice(
  userId: string,
  businessId: string,
  invoiceId: string,
  scopeBranchId?: string
): Promise<ServiceResult<Invoice & { lines: InvoiceLine[]; receipt: Receipt | null }>> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access) return notFound("Invoice not found")

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: { lines: { orderBy: { lineNumber: "asc" } }, receipt: true },
  })
  if (!invoice) return notFound("Invoice not found")
  if (!canAccessBranch(access, invoice.branchId)) return notFound("Invoice not found")
  if (scopeBranchId && invoice.branchId !== scopeBranchId) {
    return notFound("Invoice not found")
  }

  return { ok: true, data: invoice }
}

export async function updateInvoice(
  userId: string,
  businessId: string,
  invoiceId: string,
  input: InvoiceInput,
  scopeBranchId?: string
): Promise<ServiceResult<Invoice & { lines: InvoiceLine[] }>> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access) return notFound("Invoice not found")

  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    select: { id: true, branchId: true, registrationStatus: true },
  })
  if (!existing) return notFound("Invoice not found")
  if (!canAccessBranch(access, existing.branchId)) {
    return notFound("Invoice not found")
  }
  if (scopeBranchId && existing.branchId !== scopeBranchId) {
    return notFound("Invoice not found")
  }
  if (existing.registrationStatus === "REGISTERED") {
    return { ok: false, status: 409, error: "Registered invoices cannot be edited" }
  }

  const lines = normalizeLines(input.lines)
  const { subtotalCents, taxAmountCents, grandTotalCents } = computeTotals(
    lines,
    input.taxRate
  )

  const snapshot = await sellerSnapshot(businessId)

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({ where: { invoiceId: existing.id } })
    return tx.invoice.update({
      where: { id: existing.id },
      data: {
        date: input.date,
        ...snapshot,
        taxCode: input.taxCode,
        taxRate: new Prisma.Decimal(input.taxRate),
        subtotal: centsToDecimal(subtotalCents),
        taxAmount: centsToDecimal(taxAmountCents),
        grandTotal: centsToDecimal(grandTotalCents),
        transactionType: input.transactionType,
        incomeWithholdRate: new Prisma.Decimal(input.incomeWithholdRate),
        cashierName: input.cashierName || "AAA",
        salesPersonName: input.salesPersonName || "AAA",
        ...buyerData(input.buyer),
        irn: null,
        registrationStatus: null,
        registrationError: Prisma.JsonNull,
        registeredAt: null,
        cancellationReason: null,
        cancellationRemark: null,
        cancellationError: Prisma.JsonNull,
        cancelledAt: null,
        lines: { create: lineCreateData(lines) },
      },
      include: { lines: true },
    })
  })

  return { ok: true, data: invoice }
}

export async function deleteInvoice(
  userId: string,
  businessId: string,
  invoiceId: string,
  scopeBranchId?: string
): Promise<ServiceResult<{ id: string }>> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access) return notFound("Invoice not found")

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    select: {
      id: true,
      branchId: true,
      registrationStatus: true,
      receipt: { select: { status: true } },
    },
  })
  if (!invoice) return notFound("Invoice not found")
  if (!canAccessBranch(access, invoice.branchId)) return notFound("Invoice not found")
  if (scopeBranchId && invoice.branchId !== scopeBranchId) {
    return notFound("Invoice not found")
  }
  if (
    invoice.registrationStatus === "REGISTERED" ||
    invoice.receipt?.status === "ISSUED"
  ) {
    return {
      ok: false,
      status: 409,
      error: "Registered invoices with issued receipts cannot be deleted",
    }
  }

  await prisma.invoice.delete({ where: { id: invoice.id } })
  return { ok: true, data: { id: invoice.id } }
}
