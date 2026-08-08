import type { Prisma } from "@prisma/client"

export type BulkOperationResult = {
  conversationId: string
  results: unknown[]
}

export function getCallbackHeaders(): Record<string, string> {
  const value = process.env.EINVOICE_CALLBACK_URL?.trim()
  if (!value) {
    throw new Error(
      "Missing required EINVOICE_CALLBACK_URL for bulk EIMS registration"
    )
  }
  return { callback: value }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function firstString(...values: unknown[]): string | null {
  return (
    values
      .find(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
      ?.trim() ?? null
  )
}

export function parseBulkOperationResponse(
  data: unknown
): BulkOperationResult | null {
  const root = objectValue(data)
  if (!root) return null
  const body = root.body
  const nested = objectValue(body)
  const conversationId = firstString(
    root.conversationId,
    root.ConversationId,
    root.conversionId,
    root.ConversionId,
    nested?.conversationId,
    nested?.ConversationId,
    nested?.conversionId,
    nested?.ConversionId
  )
  return conversationId ? { conversationId, results: [] } : null
}

export function callbackResults(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  const root = objectValue(body)
  if (!root) return []
  for (const value of [root.results, root.body, root.data]) {
    if (Array.isArray(value)) return value
  }
  return []
}

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}
