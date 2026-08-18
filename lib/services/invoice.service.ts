import { Prisma } from "@prisma/client"
import type { Invoice, InvoiceLine, Receipt } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ConflictError } from "@/lib/api-error"
import { sellerSnapshotFromBusiness } from "@/lib/einvoice/payload"
import {
  claimIdempotencyKey,
  clearIdempotencyKey,
  settleIdempotencyKey,
} from "@/lib/idempotency"
import { hasIssuedReceipt } from "@/lib/invoice"
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
  summary: {
    count: number
    totalCents: number
    taxCents: number
  }
}

export async function listInvoices(
  businessId: string,
  opts: {
    page?: number
    pageSize?: number
    branchId?: string | null
    userId?: string | null
    from?: string | null
    to?: string | null
  } = {}
): Promise<InvoiceListResult> {
  const page = Math.max(1, opts.page || 1)
  const pageSize = Math.min(50, Math.max(1, opts.pageSize || 10))

  const where: Prisma.InvoiceWhereInput = {
    businessId,
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.from && opts.to ? { date: { gte: opts.from, lte: opts.to } } : {}),
  }

  const [invoices, total, failed, cancelled, issuedReceipts, aggregate] =
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
        where: {
          status: "ISSUED",
          invoice: {
            businessId,
            ...(opts.branchId ? { branchId: opts.branchId } : {}),
            ...(opts.userId ? { userId: opts.userId } : {}),
          },
        },
      }),
      prisma.invoice.aggregate({
        where,
        _sum: { grandTotal: true, taxAmount: true },
        _count: true,
      }),
    ])

  return {
    invoices,
    total,
    page,
    pageSize,
    stats: { totalInvoices: total, failed, cancelled, issuedReceipts },
    summary: {
      count: aggregate._count,
      totalCents: Math.round(Number(aggregate._sum.grandTotal ?? 0) * 100),
      taxCents: Math.round(Number(aggregate._sum.taxAmount ?? 0) * 100),
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

export async function getInvoice(
  businessId: string,
  invoiceId: string,
  scopeBranchId?: string | null,
  userId?: string | null
): Promise<Invoice & { lines: InvoiceLine[]; receipt: Receipt | null } | null> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      businessId,
      ...(scopeBranchId ? { branchId: scopeBranchId } : {}),
      ...(userId ? { userId } : {}),
    },
    include: { lines: { orderBy: { lineNumber: "asc" } }, receipt: true },
  })
  return invoice
}

export async function createInvoice(
  businessId: string,
  branchId: string,
  userId: string,
  input: InvoiceInput,
  opts?: { idempotencyKey?: string }
): Promise<Invoice & { lines: InvoiceLine[] }> {
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
      if (!invoice) throw new ConflictError("Invoice not found")
      return invoice
    }
    if (claim.kind === "busy") {
      throw new ConflictError(
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
    return invoice
  } catch (error) {
    if (claimedKey) {
      await clearIdempotencyKey(claimedKey).catch(() => {})
    }
    throw error
  }
}

export async function updateInvoice(
  businessId: string,
  invoiceId: string,
  input: InvoiceInput,
  scopeBranchId?: string | null,
  userId?: string | null
): Promise<Invoice & { lines: InvoiceLine[] } | null> {
  const existing = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      businessId,
      ...(scopeBranchId ? { branchId: scopeBranchId } : {}),
      ...(userId ? { userId } : {}),
    },
    select: { id: true, registrationStatus: true },
  })
  if (!existing) return null
  if (existing.registrationStatus === "REGISTERED") {
    throw new ConflictError("Registered invoices cannot be edited")
  }

  const lines = normalizeLines(input.lines)
  const { subtotalCents, taxAmountCents, grandTotalCents } = computeTotals(
    lines,
    input.taxRate
  )

  const snapshot = await sellerSnapshot(businessId)

  return prisma.$transaction(async (tx) => {
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
}

export async function deleteInvoice(
  businessId: string,
  invoiceId: string,
  scopeBranchId?: string | null,
  userId?: string | null
): Promise<{ id: string } | null> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      businessId,
      ...(scopeBranchId ? { branchId: scopeBranchId } : {}),
      ...(userId ? { userId } : {}),
    },
    select: {
      id: true,
      registrationStatus: true,
      receipt: { select: { status: true } },
    },
  })
  if (!invoice) return null
  if (
    invoice.registrationStatus === "REGISTERED" ||
    invoice.receipt?.status === "ISSUED"
  ) {
    throw new ConflictError(
      "Registered invoices with issued receipts cannot be deleted"
    )
  }

  await prisma.invoice.delete({ where: { id: invoice.id } })
  return { id: invoice.id }
}

export async function bulkDeleteInvoices(
  businessId: string,
  branchId: string,
  ids: string[],
  userId?: string | null
): Promise<{ deleted: number; skipped: number }> {
  const where = {
    id: { in: ids },
    businessId,
    branchId,
    ...(userId ? { userId } : {}),
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      id: true,
      registrationStatus: true,
      receipt: { select: { status: true } },
    },
  })

  const deletableIds = invoices
    .filter(
      (invoice) =>
        invoice.registrationStatus !== "REGISTERED" &&
        !hasIssuedReceipt(invoice)
    )
    .map((invoice) => invoice.id)

  const deleted = deletableIds.length
    ? (
        await prisma.invoice.deleteMany({
          where: { id: { in: deletableIds }, businessId, branchId },
        })
      ).count
    : 0

  return { deleted, skipped: ids.length - deleted }
}