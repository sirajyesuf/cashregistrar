import type { NextResponse } from "next/server"
import type { BusinessAccess } from "@/lib/business"
import { getBusinessAccess, canManageBusiness } from "@/lib/business"
import { publicError } from "@/lib/api-error"

export type OwnerGuard =
  | { ok: true; access: BusinessAccess }
  | { ok: false; response: NextResponse }

/**
 * Resolves the API-key user's access to a business and requires OWNER role,
 * used by public v1 routes. Returns a ready-to-send error response otherwise.
 */
export async function requireOwnerAccess(
  userId: string,
  businessId: string
): Promise<OwnerGuard> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access)
    return { ok: false, response: publicError(404, "NOT_FOUND", "Business not found") }
  if (!canManageBusiness(access.role)) {
    return {
      ok: false,
      response: publicError(403, "FORBIDDEN", "Business owner access required"),
    }
  }
  return { ok: true, access }
}