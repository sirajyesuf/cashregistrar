import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { callEims } from "@/lib/einvoice/client"
import { getConfig } from "@/lib/einvoice/config"
import { buildRegisterPayload } from "@/lib/einvoice/payload"
import { validateLineTotals } from "@/lib/einvoice/validate"
import { extractErrorMessage } from "@/lib/einvoice/eims-error"
import {
  getCallbackHeaders,
  parseBulkOperationResponse,
} from "@/lib/einvoice/operation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { invoiceIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const invoiceIds = Array.isArray(body.invoiceIds)
    ? [
        ...new Set(
          body.invoiceIds
            .filter(
              (id): id is string =>
                typeof id === "string" && id.trim().length > 0
            )
            .map((id) => id.trim())
        ),
      ]
    : []
  if (invoiceIds.length === 0)
    return NextResponse.json({ error: "No invoices selected" }, { status: 400 })
  if (invoiceIds.length > 50)
    return NextResponse.json(
      { error: "A maximum of 50 invoices can be submitted at once" },
      { status: 400 }
    )

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds }, userId: user.id },
    include: { lines: true },
  })
  if (invoices.length !== invoiceIds.length)
    return NextResponse.json(
      { error: "One or more invoices were not found" },
      { status: 404 }
    )

  for (const invoice of invoices) {
    if (
      invoice.registrationStatus === "REGISTERED" ||
      invoice.registrationStatus === "CANCELLED"
    ) {
      return NextResponse.json(
        { error: `Invoice ${invoice.number} cannot be registered` },
        { status: 409 }
      )
    }
    if (invoice.transactionType === "B2B" && !invoice.buyerTin) {
      return NextResponse.json(
        { error: `Invoice ${invoice.number} requires a buyer TIN` },
        { status: 400 }
      )
    }
    if (invoice.lines.some((line) => line.description.trim().length < 3)) {
      return NextResponse.json(
        { error: `Invoice ${invoice.number} has an invalid line description` },
        { status: 400 }
      )
    }
    const issues = validateLineTotals({
      lines: invoice.lines,
      taxRate: Number(invoice.taxRate),
    })
    if (issues.length > 0)
      return NextResponse.json(
        { error: `Invoice ${invoice.number} has invalid line totals` },
        { status: 400 }
      )
  }

  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const orderedInvoices = invoiceIds.map((id) => byId.get(id)!)
  const seller = await prisma.sellerProfile.findFirst()
  const previous = await prisma.invoice.findFirst({
    where: { irn: { not: null }, registrationStatus: "REGISTERED" },
    orderBy: { registeredAt: "desc" },
    select: { irn: true },
  })
  const startCounter = await prisma.$transaction(async (tx) => {
    const counter = await tx.counter.upsert({
      where: { name: "eims" },
      create: { name: "eims", value: 1 },
      update: {},
    })
    await tx.counter.update({
      where: { name: "eims" },
      data: { value: { increment: orderedInvoices.length } },
    })
    return counter.value
  })
  const payload = orderedInvoices.map((invoice, index) =>
    buildRegisterPayload({
      invoice,
      seller,
      invoiceCounter: startCounter + index,
      previousIrn: index === 0 ? (previous?.irn ?? null) : null,
    })
  )

  try {
    const cfg = getConfig()
    const result = await callEims("/v1/bulkRegister", payload, {
      TIN: cfg.tin,
      SYSTEM_NUMBER: cfg.systemNumber,
      ...getCallbackHeaders(),
    })
    const operationResponse = parseBulkOperationResponse(result.data)
    if (!result.ok) {
      const message = extractErrorMessage(result.data)
      return NextResponse.json(
        {
          error: message,
          statusCode: result.status,
          retryAfter: result.retryAfter,
          detail: result.data,
        },
        { status: result.status }
      )
    }
    if (!operationResponse) {
      return NextResponse.json(
        {
          error: "EIMS response did not include a conversationId",
          detail: result.data,
        },
        { status: 502 }
      )
    }

    const operation = await prisma.eimsOperation.create({
      data: {
        conversationId: operationResponse.conversationId,
        type: "REGISTER",
        items: {
          create: orderedInvoices.map((invoice, index) => ({
            invoiceId: invoice.id,
            documentNumber: String(startCounter + index),
          })),
        },
      },
    })
    await prisma.invoice.updateMany({
      where: { id: { in: invoiceIds }, userId: user.id },
      data: { registrationStatus: "PROCESSING" },
    })
    return NextResponse.json(
      {
        ok: true,
        operationId: operation.id,
        conversationId: operation.conversationId,
        count: orderedInvoices.length,
      },
      { status: 202 }
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Bulk registration failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
