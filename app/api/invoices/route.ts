import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { invoiceInputSchema } from "@/lib/invoice-schema"
import {
  getWorkspace,
  getWorkspaceAccess,
  workspaceInvoiceScope,
} from "@/lib/workspace"

export const runtime = "nodejs"

function centsToDecimal(cents: number) {
  return new Prisma.Decimal(Math.round(cents)).div(100)
}

async function requireUser() {
  const user = await getSessionUser()
  if (!user) return null
  return user
}

async function requireWorkspace(userId: string) {
  const workspace = await getWorkspace(userId)
  if (!workspace) return null
  return workspace
}

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const businessId = url.searchParams.get("businessId")
  const branchId = url.searchParams.get("branchId")

  const workspace =
    businessId && branchId
      ? await getWorkspaceAccess(user.id, businessId, branchId)
      : await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch." },
      { status: 409 }
    )
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("pageSize")) || 10)
  )

  const where = workspaceInvoiceScope(workspace)
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
    prisma.invoice.count({
      where: { ...where, registrationStatus: "CANCELLED" },
    }),
    prisma.receipt.count({
      where: { status: "ISSUED", invoice: { businessId: workspace.businessId } },
    }),
  ])

  return NextResponse.json({
    invoices,
    total,
    page,
    pageSize,
    stats: { totalInvoices: total, failed, cancelled, issuedReceipts },
  })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await requireWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch." },
      { status: 409 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = invoiceInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const {
    date,
    taxRate,
    transactionType,
    buyer,
    cashierName,
    salesPersonName,
    incomeWithholdRate,
    lines,
  } = parsed.data

  const parsedLines = lines.map((line) => ({
    ...line,
    unitPriceCents: Math.round(line.unitPriceCents),
  }))

  const subtotalCents = parsedLines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPriceCents),
    0
  )
  const taxAmountCents = Math.round((subtotalCents * taxRate) / 100)
  const grandTotalCents = subtotalCents + taxAmountCents

  const counter = await prisma.counter.upsert({
    where: {
      businessId_branchId_name: {
        businessId: workspace.businessId,
        branchId: workspace.branchId,
        name: "invoice",
      },
    },
    create: {
      businessId: workspace.businessId,
      branchId: workspace.branchId,
      name: "invoice",
      value: 1,
    },
    update: { value: { increment: 1 } },
  })
  const number = `INV-${String(counter.value).padStart(4, "0")}`

  const invoice = await prisma.invoice.create({
    data: {
      number,
      date,
      businessId: workspace.businessId,
      branchId: workspace.branchId,
      buyerLegalName: buyer.legalName,
      taxRate: new Prisma.Decimal(taxRate),
      subtotal: centsToDecimal(subtotalCents),
      taxAmount: centsToDecimal(taxAmountCents),
      grandTotal: centsToDecimal(grandTotalCents),
      transactionType,
      incomeWithholdRate: new Prisma.Decimal(incomeWithholdRate),
      cashierName: cashierName || "AAA",
      salesPersonName: salesPersonName || "AAA",
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
      userId: user.id,
      lines: {
        create: parsedLines.map((line, index) => ({
          lineNumber: index + 1,
          description: line.description,
          quantity: new Prisma.Decimal(line.quantity),
          unitPrice: centsToDecimal(line.unitPriceCents),
          total: centsToDecimal(
            Math.round(line.quantity * line.unitPriceCents)
          ),
          itemCode: line.itemCode,
          unit: line.unit || "PCS",
        })),
      },
    },
    include: { lines: true },
  })

  return NextResponse.json({ invoice }, { status: 201 })
}
