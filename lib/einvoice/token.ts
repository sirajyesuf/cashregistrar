import { prisma } from "@/lib/db"
import { getConfig } from "./config"
import { loadKeys } from "./keys"
import { signAndWrap } from "./sign"
import { EimsAuthError, eimsAuthMessage } from "./eims-error"

const DEFAULT_EXPIRY_SECONDS = 60 * 60
const SAFETY_MARGIN_MS = 60 * 1000

export type TokenInfo = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
}

function parseTokenResponse(text: string): TokenInfo | null {
  let parsed: Record<string, unknown> & { data?: Record<string, unknown> }
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  const data = (parsed?.data ?? parsed) as Record<string, unknown> | undefined
  if (!data || typeof data !== "object") return null

  const accessToken =
    typeof data.accessToken === "string" ? data.accessToken : undefined
  if (!accessToken) return null

  const rawRefresh =
    typeof data.refreshToken === "string" ? data.refreshToken : null
  const rawExpiresIn =
    typeof data.expiresIn === "number"
      ? data.expiresIn
      : typeof data.expires_in === "number"
        ? data.expires_in
        : undefined
  const rawExpiresAt =
    typeof data.expiresAt === "number" ? data.expiresAt : undefined
  const expiresAt = rawExpiresAt
    ? new Date(rawExpiresAt * 1000)
    : new Date(Date.now() + (rawExpiresIn ?? DEFAULT_EXPIRY_SECONDS) * 1000)

  return { accessToken, refreshToken: rawRefresh, expiresAt }
}

async function persistToken(
  businessId: string,
  token: TokenInfo
): Promise<TokenInfo> {
  const record = {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
  }
  await prisma.eimsToken.upsert({
    where: { businessId },
    create: { businessId, ...record },
    update: record,
  })
  return token
}

async function login(businessId: string): Promise<TokenInfo> {
  const cfg = await getConfig(businessId)
  const { privateKey, certificate } = loadKeys()
  const body = signAndWrap(privateKey, certificate, {
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    apikey: cfg.apiKey,
    tin: cfg.tin,
  })
  const res = await fetch(`${cfg.baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    if (res.status === 401) {
      throw new EimsAuthError(eimsAuthMessage(loginErrorReason(text)), 401)
    }
    throw new Error(`EIMS login failed (${res.status}): ${truncate(text)}`)
  }
  const token = parseTokenResponse(text)
  if (!token) {
    throw new Error(`EIMS login returned no accessToken: ${truncate(text)}`)
  }
  return persistToken(businessId, token)
}

async function refresh(businessId: string): Promise<TokenInfo | null> {
  const cfg = await getConfig(businessId)
  const { privateKey, certificate } = loadKeys()
  const stored = await prisma.eimsToken.findUnique({
    where: { businessId },
  })
  if (!stored?.refreshToken) return null

  const body = signAndWrap(privateKey, certificate, {
    refreshToken: stored.refreshToken,
  })
  const res = await fetch(`${cfg.baseUrl}/auth/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const token = parseTokenResponse(await res.text())
  if (!token) return null
  return persistToken(businessId, token)
}

export async function getValidToken(businessId: string): Promise<string> {
  const stored = await prisma.eimsToken.findUnique({
    where: { businessId },
  })
  if (stored && stored.expiresAt.getTime() > Date.now() + SAFETY_MARGIN_MS) {
    return stored.accessToken
  }
  const refreshed = await refresh(businessId)
  if (refreshed) return refreshed.accessToken
  const token = await login(businessId)
  return token.accessToken
}

export async function forceLogin(businessId: string): Promise<TokenInfo> {
  await prisma.eimsToken.deleteMany({ where: { businessId } })
  return login(businessId)
}

export async function forceRefresh(businessId: string): Promise<TokenInfo> {
  const refreshed = await refresh(businessId)
  if (refreshed) return refreshed
  return login(businessId)
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "********"
  return `${token.slice(0, 4)}…${token.slice(-4)}`
}

function truncate(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/**
 * Pulls a human-readable reason out of a login error body, e.g.
 * `{ details: [{ errorMessage: "Invalid Credentials" }] }` -> "Invalid Credentials".
 */
function loginErrorReason(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as {
      details?: { errorMessage?: unknown; message?: unknown }[]
      message?: unknown
    }
    if (Array.isArray(parsed.details)) {
      for (const detail of parsed.details) {
        if (typeof detail?.errorMessage === "string" && detail.errorMessage) {
          return detail.errorMessage
        }
      }
    }
    if (typeof parsed.message === "string" && parsed.message) {
      return parsed.message
    }
  } catch {
    // not JSON; fall through
  }
  return null
}
