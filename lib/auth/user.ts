import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export type SessionUser = {
  id: string
  email: string
  name: string | null
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
  }
}
