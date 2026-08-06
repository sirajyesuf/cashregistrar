import { NextResponse } from "next/server"
import type { Invoice, InvoiceLine, SellerProfile } from "@prisma/client"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { callEims, type EimsCallResult } from "@/lib/einvoice/client"
import { getConfig, type EimsConfig } from "@/lib/einvoice/config"
import { buildRegisterPayload } from "@/lib/einvoice/payload"

export const runtime = "nodejs"

/**
 * EIMS requires every invoice registered from a source system (TIN +
 * SYSTEM_NUMBER) to carry a strictly sequential DocumentNumber / InvoiceCounter
 * starting at 1. That sequence is tracked locally by the "eims" Counter row.
 *
 * The counter can drift BEHIND EIMS's real count when EIMS accepts a document
 * but the app never records it (network/parse edge cases after acceptance,
 * external registrations on the same source system, etc.). When that happens
 * EIMS rejects the out-of-sequence number with a 7001/7015 error that states
 * the expected next number ("...expected : 11").
 *
 * Self-heal: on a 7001/7015 sequence error we parse EIMS's expected number,
 * realign the "eims" counter to it (EIMS is the source of truth), and
 * auto-retry the registration once. The retry is capped at one attempt so a
 * persistent failure surfaces normally instead of looping.
 */
function extractErrorMessage(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as {
      message?: unknown
      details?: { errorMessage?: unknown }[]
      body?: unknown
    }
    if (Array.isArray(d.details)) {
      const msg = d.details
        .map((x) => (typeof x.errorMessage === "string" ? x.errorMessage : ""))
        .filter(Boolean)
        .join("; ")
      if (msg) return msg
    }
    if (Array.isArray(d.body)) {
      const msgs = d.body
        .map((item) => {
          if (item && typeof item === "object") {
            const o = item as {
              portion?: unknown
              errorMessage?: unknown
              message?: unknown
            }
            if (Array.isArray(o.errorMessage)) {
              return o.errorMessage
                .filter((m) => typeof m === "string")
                .join("; ")
            }
            if (typeof o.message === "string") return o.message
          }
          if (typeof item === "string") return item
          return ""
        })
        .filter(Boolean)
      if (msgs.length > 0) return msgs.join(" | ")
      if (typeof d.body[0] === "object") return JSON.stringify(d.body[0])
    }
    if (typeof d.message === "string") return d.message
  }
  return "EIMS registration failed"
}

/**
 * Returns true when the EIMS error message is a document/counter sequence
 * error (codes 7001 or 7015), i.e. the only errors the counter self-heal
 * understands.
 */
function isSequenceError(message: string): boolean {
  return /7001|7015/.test(message)
}

/**
 * Extracts the next expected document number from an EIMS sequence error
 * message, e.g. "Document number is not in correct sequence expected : 11"
 * returns 11. Returns null when the pattern is absent.
 */
function parseExpectedCounter(message: string): number | null {
  const match = message.match(/expected\s*:\s*(\d+)/i)
  return match ? Number(match[1]) : null
}

/**
 * Builds the register payload for a given counter value and sends it to EIMS.
 * Extracted so the self-heal path can re-run the same request with the
 * corrected document number.
 */
async function attemptRegister(
  cfg: EimsConfig,
  invoice: Invoice & { lines: InvoiceLine[] },
  seller: SellerProfile | null,
  counterValue: number,
  previousIrn: string | null
): Promise<EimsCallResult> {
  const payload = buildRegisterPayload({
    invoice,
    seller,
    invoiceCounter: counterValue,
    previousIrn,
  })
  return callEims("/v1/register", payload, {
    TIN: cfg.tin,
    SYSTEM_NUMBER: cfg.systemNumber,
  })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { invoiceId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const invoiceId =
    typeof body.invoiceId === "string" ? body.invoiceId.trim() : ""
  if (!invoiceId) {
    return NextResponse.json(
      { error: "invoiceId is required" },
      { status: 400 }
    )
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true },
  })
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  if (invoice.registrationStatus === "REGISTERED") {
    return NextResponse.json({ ok: true, irn: invoice.irn })
  }

  if (invoice.transactionType === "B2B" && !invoice.buyerTin) {
    return NextResponse.json(
      { error: "B2B invoices require a buyer TIN" },
      { status: 400 }
    )
  }

  if (invoice.lines.some((line) => line.description.trim().length < 3)) {
    return NextResponse.json(
      {
        error:
          "Every line item description must be at least 3 characters (required by EIMS)",
      },
      { status: 400 }
    )
  }

  const seller = await prisma.sellerProfile.findFirst()
  let counter = await prisma.counter.findUnique({ where: { name: "eims" } })
  if (!counter) {
    counter = await prisma.counter.create({ data: { name: "eims", value: 1 } })
  }
  const previous = await prisma.invoice.findFirst({
    where: {
      irn: { not: null },
      registrationStatus: "REGISTERED",
      id: { not: invoice.id },
    },
    orderBy: { createdAt: "desc" },
    select: { irn: true },
  })
  const previousIrn = previous?.irn ?? null

  const cfg = getConfig()
  let result = await attemptRegister(
    cfg,
    invoice,
    seller,
    counter.value,
    previousIrn
  )

  // Self-heal: realign the counter to EIMS's expected next number and retry once.
  if (!result.ok) {
    const message = extractErrorMessage(result.data)
    const expected = parseExpectedCounter(message)
    if (isSequenceError(message) && expected !== null) {
      await prisma.counter.update({
        where: { name: "eims" },
        data: { value: expected },
      })
      result = await attemptRegister(
        cfg,
        invoice,
        seller,
        expected,
        previousIrn
      )
    }
  }

  const data = result.data as { body?: { irn?: unknown } } | undefined
  const irn = typeof data?.body?.irn === "string" ? data.body.irn : null

  if (result.ok && irn) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        irn,
        registrationStatus: "REGISTERED",
        registrationError: null,
        registeredAt: new Date(),
      },
    })
    await prisma.counter.update({
      where: { name: "eims" },
      data: { value: { increment: 1 } },
    })
    return NextResponse.json({ ok: true, irn })
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      registrationStatus: "FAILED",
      registrationError: extractErrorMessage(data),
    },
  })
  return NextResponse.json(
    { error: extractErrorMessage(data) },
    { status: result.ok ? 500 : result.status }
  )
}
