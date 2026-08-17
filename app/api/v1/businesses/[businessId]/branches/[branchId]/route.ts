import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { branchPublicUpdateSchema } from "@/lib/validation/public/business"
import { canManageBusiness, getBusinessAccess } from "@/lib/business"
import { publicError, publicErrorResponse, withService } from "@/lib/api-error"
import {
  deleteBranch,
  getBranch,
  updateBranch,
} from "@/lib/services/business.service"
import { toPublicBranch } from "@/lib/dto/public/branch.dto"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; branchId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, branchId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access) return publicError(404, "NOT_FOUND", "Business not found")
  if (!canManageBusiness(access.role)) {
    return publicError(403, "FORBIDDEN", "Business owner access required")
  }

  const branch = await getBranch(businessId, branchId)
  if (!branch) return publicError(404, "NOT_FOUND", "Branch not found")
  return NextResponse.json({ branch: toPublicBranch(branch) })
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, branchId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access) return publicError(404, "NOT_FOUND", "Business not found")
  if (!canManageBusiness(access.role)) {
    return publicError(403, "FORBIDDEN", "Business owner access required")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return publicError(400, "BAD_REQUEST", "Invalid JSON body")
  }

  const parsed = branchPublicUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return publicError(
      422,
      "VALIDATION_ERROR",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    )
  }

  const result = await withService(
    () => updateBranch(businessId, branchId, parsed.data),
    publicErrorResponse
  )
  if ("error" in result) return result.error
  if (!result.data) return publicError(404, "NOT_FOUND", "Branch not found")
  return NextResponse.json({ branch: toPublicBranch(result.data) })
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, branchId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access) return publicError(404, "NOT_FOUND", "Business not found")
  if (!canManageBusiness(access.role)) {
    return publicError(403, "FORBIDDEN", "Business owner access required")
  }

  const deleted = await deleteBranch(businessId, branchId)
  if (!deleted) return publicError(404, "NOT_FOUND", "Branch not found")
  return NextResponse.json({ ok: true })
}