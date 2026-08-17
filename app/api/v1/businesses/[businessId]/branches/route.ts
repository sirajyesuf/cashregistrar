import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { branchPublicCreateSchema } from "@/lib/validation/public/business"
import { canManageBusiness, getBusinessAccess } from "@/lib/business"
import { publicError, publicErrorResponse, withService } from "@/lib/api-error"
import { createBranch, listBranches } from "@/lib/services/business.service"
import { toPublicBranch } from "@/lib/dto/public/branch.dto"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access) return publicError(404, "NOT_FOUND", "Business not found")
  if (!canManageBusiness(access.role)) {
    return publicError(403, "FORBIDDEN", "Business owner access required")
  }

  const branches = await listBranches(businessId)
  return NextResponse.json({ branches: branches.map(toPublicBranch) })
}

export async function POST(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId } = await params
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

  const parsed = branchPublicCreateSchema.safeParse(body)
  if (!parsed.success) {
    return publicError(
      422,
      "VALIDATION_ERROR",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    )
  }

  const result = await withService(
    () => createBranch(businessId, parsed.data),
    publicErrorResponse
  )
  if ("error" in result) return result.error
  return NextResponse.json({ branch: toPublicBranch(result.data) }, { status: 201 })
}