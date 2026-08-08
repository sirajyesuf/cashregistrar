import { headers } from "next/headers"
import type { Role } from "@prisma/client"
import { auth } from "@/lib/auth"

export type UserRole = Role

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
    role: session.user.role as UserRole,
  }
}
