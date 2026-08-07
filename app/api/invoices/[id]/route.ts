import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { invoiceInputSchema, type BuyerDetails } from "@/lib/invoice-schema"

export const runtime = "nodejs"

function centsToDecimal(cents: number) {
  return new Prisma.Decimal(Math.round(cents)).div(100)
}

function buyerData(buyer: BuyerDetails) {
  return {
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
  const data = parsed.data

  const lines = data.lines.map((line) => ({
    ...line,
    unitPriceCents: Math.round(line.unitPriceCents),
  }))

  const subtotalCents = lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPriceCents),
    0
  )
  const taxAmountCents = Math.round((subtotalCents * data.taxRate) / 100)
  const grandTotalCents = subtotalCents + taxAmountCents

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } })
    return tx.invoice.update({
      where: { id },
      data: {
        date: data.date,
        buyerLegalName: data.buyer.legalName,
        taxRate: centsToDecimal(data.taxRate),
        subtotal: centsToDecimal(subtotalCents),
        taxAmount: centsToDecimal(taxAmountCents),
        grandTotal: centsToDecimal(grandTotalCents),
        transactionType: data.transactionType,
        incomeWithholdRate: new Prisma.Decimal(data.incomeWithholdRate),
        cashierName: data.cashierName || "AAA",
        salesPersonName: data.salesPersonName || "AAA",
        buyerTin: data.buyer.tin,
        ...buyerData(data.buyer),
        irn: null,
        registrationStatus: null,
        registrationError: Prisma.JsonNull,
        registeredAt: null,
        lines: {
          create: lines.map((line, index) => ({
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
