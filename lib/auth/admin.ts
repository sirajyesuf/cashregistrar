import { getSessionUser, type SessionUser } from "./user"

export type AdminGuardResult =
  | { user: SessionUser; error: null; status: null }
  | { user: null; error: string; status: number }

/**
 * Returns the session user when authenticated AND an admin, otherwise an
 * error payload for the route handler to return.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const user = await getSessionUser()
  if (!user) {
    return { user: null, error: "Not authenticated", status: 401 }
  }
  if (user.role !== "ADMIN") {
    return { user: null, error: "Forbidden", status: 403 }
  }
  return { user, error: null, status: null }
}
