import { SignJWT, importPKCS8, jwtVerify } from "jose"

export const SESSION_COOKIE = "session"

const ISSUER = "cashregistrar"
const AUDIENCE = "cashregistrar-web"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export type SessionUser = {
  id: string
  email: string
  name: string | null
}

async function getSigningKey() {
  const pem = process.env.JWT_PRIVATE_KEY
  if (!pem) {
    throw new Error(
      "JWT_PRIVATE_KEY is not set. Generate one with: node scripts/genkeys.mjs"
    )
  }
  return importPKCS8(pem, "RS256")
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const key = await getSigningKey()
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key)
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const key = await getSigningKey()
    const { payload } = await jwtVerify(token, key, {
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
