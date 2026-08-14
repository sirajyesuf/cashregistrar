import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { getConfig, type EimsConfig } from "@/lib/einvoice/config"
import { validateLineTotals } from "@/lib/einvoice/validate"
import {
  isEimsAuthError,
  rateLimitMessage,
  retryAfterSeconds,
} from "@/lib/einvoice/eims-error"
import { getWorkspace, workspaceInvoiceScope } from "@/lib/workspace"
import {
  submitBulkRegistration,
  type SubmitBulkOutcome,
} from "@/lib/einvoice/bulk-submit"

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

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch." },
      { status: 409 }
    )
  }

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds }, ...workspaceInvoiceScope(workspace) },
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
      taxCode: invoice.taxCode,
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
  const businessId = workspace.businessId

  let cfg: EimsConfig
  try {
    cfg = await getConfig(businessId)
  } catch (err) {
    if (isEimsAuthError(err)) {
      return NextResponse.json(
        { error: err.message, code: err.code, statusCode: 502 },
        { status: 502 }
      )
    }
    throw err
  }

  const previous = await prisma.invoice.findFirst({
    where: { irn: { not: null }, registrationStatus: "REGISTERED", businessId },
    orderBy: { registeredAt: "desc" },
    select: { irn: true },
  })

  let outcome: SubmitBulkOutcome
  try {
    outcome = await submitBulkRegistration({
      businessId,
      invoices: orderedInvoices,
      cfg,
      previousIrn: previous?.irn ?? null,
      retryCount: 0,
    })
  } catch (err) {
    if (isEimsAuthError(err)) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          statusCode: 502,
          detail: { eimsStatusCode: err.eimsStatusCode },
        },
        { status: 502 }
      )
    }
    throw err
  }

  if (!outcome.ok) {
    const message =
      outcome.status === 429
        ? rateLimitMessage(outcome.retryAfter)
        : outcome.error
    return NextResponse.json(
      {
        error: message,
        statusCode: outcome.status,
        retryAfter: outcome.retryAfter,
        retryAfterSeconds: retryAfterSeconds(outcome.retryAfter),
        detail: outcome.detail,
      },
      { status: outcome.status }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      operationId: outcome.operationId,
      conversationId: outcome.conversationId,
      count: outcome.count,
    },
    { status: 202 }
  )
}
