import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { businessInternalUpdateSchema } from "@/lib/validation/internal/business"
import { canManageBusiness, getBusinessAccess } from "@/lib/business"
import { withService } from "@/lib/api-error"
import {
  deleteBusiness,
  getBusinessDetail,
  updateBusiness,
} from "@/lib/services/business.service"
import { toInternalBusinessDetail } from "@/lib/dto/internal/business.dto"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access)
    return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const scopedBranchId =
    access.role === "OWNER" ? undefined : access.branchId
  const detail = await getBusinessDetail(businessId, scopedBranchId)
  if (!detail)
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  return NextResponse.json(toInternalBusinessDetail(detail, access))
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access)
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  if (!canManageBusiness(access.role)) {
    return NextResponse.json(
      { error: "Business owner access required" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = businessInternalUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await withService(() =>
    updateBusiness(businessId, parsed.data)
  )
  if ("error" in result) return result.error
  return NextResponse.json({ business: result.data })
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access)
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  if (!canManageBusiness(access.role)) {
    return NextResponse.json(
      { error: "Business owner access required" },
      { status: 403 }
    )
  }

  await deleteBusiness(businessId)
  return NextResponse.json({ ok: true })
}