import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { callbackResults } from "@/lib/einvoice/operation"
import {
  extractErrorMessage,
  isSequenceError,
  parseExpectedCounter,
} from "@/lib/einvoice/eims-error"
import { eimsCounterKey } from "@/lib/workspace"

export const runtime = "nodejs"

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function resultSuccess(result: Record<string, unknown>): boolean {
  const status = text(result.status)?.toUpperCase()
  return (
    status === "A" ||
    status === "ACTIVE" ||
    status === "C" ||
    status === "CANCELLED"
  )
}

function resultError(result: Record<string, unknown>): Prisma.InputJsonValue {
  return result as Prisma.InputJsonValue
}

/**
 * Returns the next number EIMS expects when the result carries a
 * document/counter sequence error (7001/7015), otherwise null.
 */
function expectedSequenceCounter(result: Record<string, unknown>): number | null {
  const message = extractErrorMessage(result)
  return isSequenceError(message) ? parseExpectedCounter(message) : null
}

/**
 * Realigns the "eims" counter to EIMS's expected next number. Only moves the
 * counter FORWARD: a stale callback for an old batch must never clobber a
 * newer operation that already advanced past it.
 */
async function realignCounter(
  tx: Prisma.TransactionClient,
  businessId: string,
  expected: number
): Promise<void> {
  const counterKey = { ...eimsCounterKey(businessId), name: "eims" }
  const counter = await tx.counter.findUnique({
    where: { businessId_branchId_name: counterKey },
  })
  if (!counter || expected > counter.value) {
    await tx.counter.upsert({
      where: { businessId_branchId_name: counterKey },
      create: { ...counterKey, value: expected },
      update: { value: expected },
    })
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const root = objectValue(body)
  const conversationId = text(
    root?.conversationId ??
      root?.ConversationId ??
      root?.conversionId ??
      root?.ConversionId
  ) ?? text(
    Array.isArray(body)
      ? body
          .map((entry) => objectValue(entry)?.["conversionId"])
          .find((value) => typeof value === "string" && value.trim())
      : undefined
  )
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 }
    )
  }

  const operation = await prisma.eimsOperation.findUnique({
    where: { conversationId },
    include: { items: true },
  })
  if (!operation) {
    return NextResponse.json(
      { error: "Unknown conversationId" },
      { status: 404 }
    )
  }

  const results = callbackResults(body)
  if (results.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  let processed = 0
  await prisma.$transaction(async (tx) => {
    for (const raw of results) {
      const result = objectValue(raw)
      if (!result) continue
      const irn = text(result.irn ?? result.Irn ?? result.IRN)
      const documentNumber = text(
        result.documentNumber ?? result.DocumentNumber ?? result.docNo
      )
      const item = operation.items.find(
        (candidate) =>
          (documentNumber && candidate.documentNumber === documentNumber) ||
          (irn && candidate.irn === irn)
      )
      if (!item) continue

      const success =
        resultSuccess(result) && (operation.type === "CANCEL" || Boolean(irn))
      if (success) {
        await tx.eimsOperationItem.update({
          where: { id: item.id },
          data: {
            status: "SUCCEEDED",
            irn: irn ?? item.irn,
            rawResult: resultError(result),
            error: Prisma.DbNull,
          },
        })
        await tx.invoice.update({
          where: { id: item.invoiceId },
          data: {
            registrationStatus:
              operation.type === "REGISTER" ? "REGISTERED" : "CANCELLED",
            irn: operation.type === "REGISTER" ? irn : undefined,
            registeredAt:
              operation.type === "REGISTER" ? new Date() : undefined,
            registrationError: Prisma.DbNull,
          },
        })
      } else {
        await tx.eimsOperationItem.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            error: resultError(result),
            rawResult: resultError(result),
          },
        })
        await tx.invoice.update({
          where: { id: item.invoiceId },
          data: {
            ...(operation.type === "REGISTER"
              ? { registrationStatus: "FAILED" as const }
              : {}),
            registrationError: resultError(result),
          },
        })
        if (operation.type === "REGISTER") {
          const expected = expectedSequenceCounter(result)
          if (expected !== null) {
            await realignCounter(tx, operation.businessId, expected)
          }
        }
      }
      processed += 1
    }

    const items = await tx.eimsOperationItem.findMany({
      where: { operationId: operation.id },
    })
    const succeeded = items.filter((item) => item.status === "SUCCEEDED").length
    const failed = items.filter((item) => item.status === "FAILED").length
    const status =
      succeeded > 0 && failed > 0
        ? "PARTIAL"
        : succeeded > 0
          ? "COMPLETED"
          : failed > 0
            ? "FAILED"
            : "PROCESSING"
    await tx.eimsOperation.update({
      where: { id: operation.id },
      data: {
        status,
        rawResponse: body as Prisma.InputJsonValue,
        completedAt: status === "PROCESSING" ? null : new Date(),
      },
    })
  })

  return NextResponse.json({ ok: true, processed })
}
