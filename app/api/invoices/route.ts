import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { invoiceInputSchema } from "@/lib/invoice-schema"

export const runtime = "nodejs"

function centsToDecimal(cents: number) {
  return new Prisma.Decimal(Math.round(cents)).div(100)
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
        buyerLegalName: true,
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
    where: { name: "invoice" },
    create: { name: "invoice", value: 1 },
    update: { value: { increment: 1 } },
  })
  const number = `INV-${String(counter.value).padStart(4, "0")}`

  const invoice = await prisma.invoice.create({
    data: {
      number,
      date,
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
