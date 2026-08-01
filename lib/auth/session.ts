import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "session"

const ISSUER = "cashregistrar"
const AUDIENCE = "cashregistrar-web"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export type SessionUser = {
  id: string
  email: string
  name: string | null
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Generate one with: node scripts/genkeys.mjs"
    )
  }
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    if (!payload.sub) return null
    return {
      id: payload.sub,
      email: (payload.email as string) ?? "",
      name: (payload.name as string | null) ?? null,
    }
  } catch {
    return null
  }
}

export { MAX_AGE_SECONDS }
