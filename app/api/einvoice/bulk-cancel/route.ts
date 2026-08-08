import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { callEims } from "@/lib/einvoice/client"
import { getConfig } from "@/lib/einvoice/config"
import {
  getCallbackHeaders,
  parseBulkOperationResponse,
} from "@/lib/einvoice/operation"
import { hasIssuedReceipt } from "@/lib/invoice"
import { extractErrorMessage } from "@/lib/einvoice/eims-error"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { invoiceIds?: unknown; reasonCode?: unknown; remark?: unknown }
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
    select: {
      id: true,
      number: true,
      irn: true,
      registrationStatus: true,
      receipt: { select: { status: true } },
    },
  })
  if (invoices.length !== invoiceIds.length)
    return NextResponse.json(
      { error: "One or more invoices were not found" },
      { status: 404 }
    )
  for (const invoice of invoices) {
    if (invoice.registrationStatus !== "REGISTERED" || !invoice.irn)
      return NextResponse.json(
        { error: `Invoice ${invoice.number} is not registered` },
        { status: 400 }
      )
    if (hasIssuedReceipt(invoice))
      return NextResponse.json(
        { error: `Invoice ${invoice.number} has an issued receipt` },
        { status: 409 }
      )
  }

  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const orderedInvoices = invoiceIds.map((id) => byId.get(id)!)
  const reasonCode =
    typeof body.reasonCode === "string" && body.reasonCode.trim()
      ? body.reasonCode.trim()
      : "1"
  const remark = typeof body.remark === "string" ? body.remark.trim() : ""

  try {
    const cfg = getConfig()
    const result = await callEims(
      "/v1/bulkCancel",
      orderedInvoices.map((invoice) => ({
        Irn: invoice.irn!,
        ReasonCode: reasonCode,
        Remark: remark,
      })),
      {
        TIN: cfg.tin,
        SYSTEM_NUMBER: cfg.systemNumber,
        ...getCallbackHeaders(),
      }
    )
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
        type: "CANCEL",
        items: {
          create: orderedInvoices.map((invoice) => ({
            invoiceId: invoice.id,
            irn: invoice.irn!,
          })),
        },
      },
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
      err instanceof Error ? err.message : "Bulk cancellation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
