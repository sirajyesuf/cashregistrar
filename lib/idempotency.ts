import { createHash } from "crypto"
import { prisma } from "@/lib/db"
import { isPrismaUniqueError } from "@/lib/business"

/**
 * Idempotency for the public invoice-create endpoint. A client supplies an
 * `Idempotency-Key` header; we claim the key before creating anything and
 * settle it with the created invoice id afterwards, so a retried request
 * returns the original invoice instead of creating a duplicate.
 */

export function hashIdempotencyKey(
  raw: string,
  userId: string,
  businessId: string
): string {
  return createHash("sha256")
    .update(`${userId}:${businessId}:${raw}`)
    .digest("hex")
}

export type ClaimResult =
  | { kind: "new"; keyHash: string }
  | { kind: "replay"; invoiceId: string }
  | { kind: "busy" }

export async function claimIdempotencyKey(
  raw: string,
  userId: string,
  businessId: string
): Promise<ClaimResult> {
  const keyHash = hashIdempotencyKey(raw, userId, businessId)

  const existing = await prisma.idempotencyKey.findUnique({
    where: { keyHash },
  })
  if (existing) {
    if (existing.invoiceId) {
      return { kind: "replay", invoiceId: existing.invoiceId }
    }
    return { kind: "busy" }
  }

  try {
    await prisma.idempotencyKey.create({
      data: { keyHash, userId, businessId },
    })
    return { kind: "new", keyHash }
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      const winner = await prisma.idempotencyKey.findUnique({
        where: { keyHash },
      })
      if (winner?.invoiceId) {
        return { kind: "replay", invoiceId: winner.invoiceId }
      }
      return { kind: "busy" }
    }
    throw err
  }
}

export async function settleIdempotencyKey(
  keyHash: string,
  invoiceId: string
): Promise<void> {
  await prisma.idempotencyKey.update({ where: { keyHash }, data: { invoiceId } })
}

export async function clearIdempotencyKey(keyHash: string): Promise<void> {
  await prisma.idempotencyKey.deleteMany({ where: { keyHash } })
}
