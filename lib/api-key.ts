import { createHash, randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"

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

export async function authenticateApiKey(
  request: Request
): Promise<{ userId: string; keyId: string } | null> {
  const header = request.headers.get("authorization")
  if (!header) return null

  const [scheme, token] = header.split(" ")
  if (scheme !== "Bearer" || !token) return null

  const apiKey = await prisma.apiKey.findUnique({
    where: { tokenHash: hashApiKey(token) },
    select: { id: true, userId: true },
  })
  if (!apiKey) return null

  await prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {})

  return { userId: apiKey.userId, keyId: apiKey.id }
}

export type ApiKeyGuard =
  | { ok: true; userId: string; keyId: string }
  | { ok: false; response: NextResponse }

/**
 * Route guard for public v1 endpoints. Authenticates the API key and returns
 * either the resolved identity or a ready-to-return 401 response, collapsing
 * the boilerplate every v1 route used to repeat.
 */
export async function requireApiKey(request: Request): Promise<ApiKeyGuard> {
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or missing API key" },
        { status: 401 }
      ),
    }
  }
  return { ok: true, ...auth }
}
