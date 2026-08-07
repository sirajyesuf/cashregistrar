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

type ParsedInvoice = {
  error?: { status: number; message: string }
  data?: {
    date: string
    taxRate: number
    transactionType: "B2B" | "B2C"
    incomeWithholdRate: number
    cashierName: string
    salesPersonName: string
    buyer: Record<string, unknown>
    buyerLegalName: string
    buyerTin: string
    subtotalCents: number
    taxAmountCents: number
    grandTotalCents: number
    lines: {
      description: string
      quantity: number
      unitPriceCents: number
      itemCode: string
      unit: string
    }[]
  }
}

function parseInvoiceBody(body: {
  date?: unknown
  taxRate?: unknown
  transactionType?: unknown
  buyer?: Record<string, unknown> | null
  cashierName?: unknown
  salesPersonName?: unknown
  incomeWithholdRate?: unknown
  lines?: LineInput[]
}): ParsedInvoice {
  const date = typeof body.date === "string" ? body.date : ""
  const taxRate = Number(body.taxRate)
  const transactionType = body.transactionType === "B2C" ? "B2C" : "B2B"
  const incomeWithholdRate = Math.min(
    100,
    Math.max(0, Number(body.incomeWithholdRate) || 2)
  )
  const cashierName = str(body.cashierName) || "AAA"
  const salesPersonName = str(body.salesPersonName) || "AAA"
  const buyer = body.buyer && typeof body.buyer === "object" ? body.buyer : {}
  const buyerLegalName = str(buyer.legalName)
  const buyerTin = str(buyer.tin)
  const lines = Array.isArray(body.lines) ? body.lines : []

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      error: { status: 400, message: "A valid date is required" },
    }
  }
  if (!buyerLegalName) {
    return {
      error: { status: 400, message: "Customer legal name is required" },
    }
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return {
      error: { status: 400, message: "Tax rate must be between 0 and 100" },
    }
  }
  if (lines.length === 0) {
    return {
      error: { status: 400, message: "At least one line item is required" },
    }
  }
  if (transactionType === "B2B" && !buyerTin) {
    return {
      error: { status: 400, message: "B2B invoices require a buyer TIN" },
    }
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
    if (line.description.length < 3) {
      return {
        error: {
          status: 400,
          message:
            "Every line item description must be at least 3 characters (required by EIMS)",
        },
      }
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return {
        error: {
          status: 400,
          message: "Every line item needs a quantity greater than zero",
        },
      }
    }
    if (line.unitPriceCents < 0) {
      return {
        error: { status: 400, message: "Unit price cannot be negative" },
      }
    }
  }

  const subtotalCents = parsedLines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPriceCents),
    0
  )
  const taxAmountCents = Math.round((subtotalCents * taxRate) / 100)
  const grandTotalCents = subtotalCents + taxAmountCents

  return {
    data: {
      date,
      taxRate,
      transactionType,
      incomeWithholdRate,
      cashierName,
      salesPersonName,
      buyer,
      buyerLegalName,
      buyerTin,
      subtotalCents,
      taxAmountCents,
      grandTotalCents,
      lines: parsedLines,
    },
  }
}

function buyerData(buyer: Record<string, unknown>) {
  return {
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
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await context.params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { lineNumber: "asc" } },
      receipt: true,
    },
  })

  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  return NextResponse.json({ invoice })
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await context.params

  const existing = await prisma.invoice.findUnique({
    where: { id },
    select: { userId: true, registrationStatus: true },
  })

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  if (existing.registrationStatus === "REGISTERED") {
    return NextResponse.json(
      {
        error: "Registered invoices cannot be edited",
      },
      { status: 409 }
    )
  }

  let body: {
    date?: unknown
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

  const parsed = parseInvoiceBody(body)
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error.message }, {
      status: parsed.error.status,
    })
  }
  const data = parsed.data!

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } })
    return tx.invoice.update({
      where: { id },
      data: {
        date: data.date,
        buyerLegalName: data.buyerLegalName,
        taxRate: centsToDecimal(data.taxRate),
        subtotal: centsToDecimal(data.subtotalCents),
        taxAmount: centsToDecimal(data.taxAmountCents),
        grandTotal: centsToDecimal(data.grandTotalCents),
        transactionType: data.transactionType,
        incomeWithholdRate: new Prisma.Decimal(data.incomeWithholdRate),
        cashierName: data.cashierName,
        salesPersonName: data.salesPersonName,
        buyerTin: data.buyerTin,
        ...buyerData(data.buyer),
        irn: null,
        registrationStatus: null,
        registrationError: Prisma.JsonNull,
        registeredAt: null,
        lines: {
          create: data.lines.map((line, index) => ({
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
  })

  return NextResponse.json({ invoice })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await context.params

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  await prisma.invoice.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
