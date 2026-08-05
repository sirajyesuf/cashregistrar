import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function centsToDecimal(cents: number) {
  return new Prisma.Decimal(Math.round(cents)).div(100)
}

type LineInput = {
  description?: unknown
  quantity?: unknown
  unitPriceCents?: unknown
  itemCode?: unknown
  unit?: unknown
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function requireUser() {
  const user = await getSessionUser()
  if (!user) return null
  return user
}

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("pageSize")) || 10)
  )

  const where = { userId: user.id }
  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        number: true,
        date: true,
        customerName: true,
        taxRate: true,
        grandTotal: true,
        irn: true,
        registrationStatus: true,
        createdAt: true,
        _count: { select: { lines: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ])

  return NextResponse.json({ invoices, total, page, pageSize })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: {
    date?: unknown
    customerName?: unknown
    taxRate?: unknown
    transactionType?: unknown
    buyer?: Record<string, unknown> | null
    cashierName?: unknown
    salesPersonName?: unknown
    incomeWithholdRate?: unknown
    lines?: LineInput[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const date = typeof body.date === "string" ? body.date : ""
  const customerName =
    typeof body.customerName === "string" ? body.customerName.trim() : ""
  const taxRate = Number(body.taxRate)
  const transactionType = body.transactionType === "B2C" ? "B2C" : "B2B"
  const incomeWithholdRate = Math.min(
    100,
    Math.max(0, Number(body.incomeWithholdRate) || 2)
  )
  const cashierName = str(body.cashierName) || "AAA"
  const salesPersonName = str(body.salesPersonName) || "AAA"
  const buyer = body.buyer && typeof body.buyer === "object" ? body.buyer : {}
  const buyerTin = str(buyer.tin)
  const lines = Array.isArray(body.lines) ? body.lines : []

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "A valid date is required" },
      { status: 400 }
    )
  }
  if (!customerName) {
    return NextResponse.json(
      { error: "Customer name is required" },
      { status: 400 }
    )
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return NextResponse.json(
      { error: "Tax rate must be between 0 and 100" },
      { status: 400 }
    )
  }
  if (lines.length === 0) {
    return NextResponse.json(
      { error: "At least one line item is required" },
      { status: 400 }
    )
  }
  if (transactionType === "B2B" && !buyerTin) {
    return NextResponse.json(
      { error: "B2B invoices require a buyer TIN" },
      { status: 400 }
    )
  }

  const parsedLines = lines.map((line) => {
    const description =
      typeof line.description === "string" ? line.description.trim() : ""
    const quantity = Number(line.quantity)
    const unitPriceCents = Math.round(Number(line.unitPriceCents) || 0)
    return {
      description,
      quantity,
      unitPriceCents,
      itemCode: str(line.itemCode),
      unit: str(line.unit) || "PCS",
    }
  })

  for (const line of parsedLines) {
    if (!line.description) {
      return NextResponse.json(
        { error: "Every line item needs a description" },
        { status: 400 }
      )
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return NextResponse.json(
        { error: "Every line item needs a quantity greater than zero" },
        { status: 400 }
      )
    }
    if (line.unitPriceCents < 0) {
      return NextResponse.json(
        { error: "Unit price cannot be negative" },
        { status: 400 }
      )
    }
  }

  const subtotalCents = parsedLines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPriceCents),
    0
  )
  const taxAmountCents = Math.round((subtotalCents * taxRate) / 100)
  const grandTotalCents = subtotalCents + taxAmountCents

  const counter = await prisma.counter.upsert({
    where: { name: "invoice" },
    create: { name: "invoice", value: 1 },
    update: { value: { increment: 1 } },
  })
  const number = `INV-${String(counter.value).padStart(4, "0")}`

  const invoice = await prisma.invoice.create({
    data: {
      number,
      date,
      customerName,
      taxRate: new Prisma.Decimal(taxRate),
      subtotal: centsToDecimal(subtotalCents),
      taxAmount: centsToDecimal(taxAmountCents),
      grandTotal: centsToDecimal(grandTotalCents),
      transactionType,
      incomeWithholdRate: new Prisma.Decimal(incomeWithholdRate),
      cashierName,
      salesPersonName,
      buyerLegalName: str(buyer.legalName),
      buyerTin: buyerTin,
      buyerVatNumber: str(buyer.vatNumber),
      buyerIdType: str(buyer.idType),
      buyerIdNumber: str(buyer.idNumber),
      buyerEmail: str(buyer.email),
      buyerPhone: str(buyer.phone),
      buyerCity: str(buyer.city),
      buyerRegion: str(buyer.region),
      buyerCountry: str(buyer.country),
      buyerZone: str(buyer.zone),
      buyerKebele: str(buyer.kebele),
      buyerWereda: str(buyer.wereda),
      buyerHouseNumber: str(buyer.houseNumber),
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
          unit: line.unit,
        })),
      },
    },
    include: { lines: true },
  })

  return NextResponse.json({ invoice }, { status: 201 })
}
