import { cookies } from "next/headers"
import { SESSION_COOKIE, verifySessionToken } from "./session"

export async function getSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}
