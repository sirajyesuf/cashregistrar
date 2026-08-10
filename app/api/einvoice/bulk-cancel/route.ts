import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { randomUUID } from "node:crypto"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { callEims } from "@/lib/einvoice/client"
import { getConfig } from "@/lib/einvoice/config"
import { hasIssuedReceipt } from "@/lib/invoice"
import { extractErrorMessage } from "@/lib/einvoice/eims-error"

export const runtime = "nodejs"

/**
 * EIMS bulk cancellation is synchronous: the response body is an array of
 * per-IRN results (no conversationId, no callback). A result is a success when
 * its lowercase `status` is "C" (cancelled); otherwise it carries an uppercase
 * `Status` (e.g. "Processing_Error") with a human-readable `msg`.
 */

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function cancelResultEntries(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    )
  }
  const root =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null
  const body = root?.body
  if (Array.isArray(body)) {
    return body.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    )
  }
  return []
}

function cancelResultSuccess(entry: Record<string, unknown>): boolean {
  const status = text(entry.status)?.toUpperCase()
  return status === "C" || status === "CANCELLED"
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

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
      }
    )
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

    const entries = cancelResultEntries(result.data)

    // EIMS returns a NEW IRN for each cancelled document, so a success cannot
    // be matched to our submission by IRN. Results come back in submission
    // order: match each entry positionally, using the entry IRN only as a
    // secondary check against the submitted invoice.
    const byIrn = new Map(
      orderedInvoices.map((invoice) => [invoice.irn, invoice])
    )
    const outcomes = entries.map((entry, index) => {
      const irn = text(entry.Irn) ?? text(entry.irn)
      const positional = orderedInvoices[index]
      const irnMatch = irn ? byIrn.get(irn) : undefined
      const invoice = irnMatch ?? positional
      return {
        entry,
        irn,
        invoice,
        success: Boolean(invoice) && cancelResultSuccess(entry),
      }
    })

    if (outcomes.length === 0) {
      return NextResponse.json(
        {
          error: "EIMS returned no matching cancellation results",
          detail: result.data,
        },
        { status: 502 }
      )
    }

    const succeeded = outcomes.filter((o) => o.success).length
    const failed = outcomes.length - succeeded

    const operation = await prisma.$transaction(async (tx) => {
      const op = await tx.eimsOperation.create({
        data: {
          conversationId: `cancel-${Date.now()}-${randomUUID()}`,
          type: "CANCEL",
          status: "PROCESSING",
          rawResponse: asJson(result.data),
          items: {
            create: orderedInvoices.map((invoice) => {
              const outcome = outcomes.find(
                (o) => o.invoice?.id === invoice.id
              )
              return {
                invoiceId: invoice.id,
                irn: invoice.irn!,
                status: outcome?.success ? "SUCCEEDED" : "FAILED",
                error: outcome && !outcome.success ? asJson(outcome.entry) : Prisma.DbNull,
                rawResult: outcome ? asJson(outcome.entry) : Prisma.DbNull,
              }
            }),
          },
        },
      })
      for (const outcome of outcomes) {
        if (!outcome.invoice) continue
        await tx.invoice.update({
          where: { id: outcome.invoice.id },
          data: outcome.success
            ? {
                registrationStatus: "CANCELLED",
                registrationError: Prisma.DbNull,
              }
            : { registrationError: asJson(outcome.entry) },
        })
      }
      const status =
        succeeded > 0 && failed > 0
          ? "PARTIAL"
          : succeeded > 0
            ? "COMPLETED"
            : "FAILED"
      await tx.eimsOperation.update({
        where: { id: op.id },
        data: { status, completedAt: new Date() },
      })
      return op
    })

    return NextResponse.json({
      ok: true,
      operationId: operation.id,
      count: outcomes.length,
      succeeded,
      failed,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Bulk cancellation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
