import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export type UserRole = "user" | "admin"

export type SessionUser = {
  id: string
  email: string
  name: string | null
  role: UserRole
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user) return null
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    role: session.user.role === "admin" ? "admin" : "user",
  }
}
