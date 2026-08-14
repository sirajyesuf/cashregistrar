import { createHash, randomBytes } from "crypto"
import { z } from "zod"

export const API_KEY_PREFIX = "cr_live_"

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
})

export function generateApiKey(): { raw: string; prefix: string } {
  const raw = `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`
  return { raw, prefix: raw.slice(0, 11) }
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export function maskApiKey(prefix: string): string {
  return `${prefix}…`
}
