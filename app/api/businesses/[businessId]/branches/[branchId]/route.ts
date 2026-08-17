import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { branchInternalUpdateSchema } from "@/lib/validation/internal/business"
import {
  canAccessBranch,
  canManageBranch,
  canManageBusiness,
  getBusinessAccess,
} from "@/lib/business"
import { withService } from "@/lib/api-error"
import {
  deleteBranch,
  getBranch,
  updateBranch,
} from "@/lib/services/business.service"
import { toInternalBranch } from "@/lib/dto/internal/branch.dto"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; branchId: string }> }

export async function GET(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, branchId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canAccessBranch(access, branchId)) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 })
  }

  const branch = await getBranch(businessId, branchId)
  if (!branch)
    return NextResponse.json({ error: "Branch not found" }, { status: 404 })
  return NextResponse.json({ branch: toInternalBranch(branch) })
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, branchId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (
    !access ||
    !canManageBranch(access.role) ||
    !canAccessBranch(access, branchId)
  ) {
    return NextResponse.json(
      { error: "Branch management access required" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = branchInternalUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await withService(() =>
    updateBranch(businessId, branchId, parsed.data)
  )
  if ("error" in result) return result.error
  if (!result.data)
    return NextResponse.json({ error: "Branch not found" }, { status: 404 })
  return NextResponse.json({ branch: toInternalBranch(result.data) })
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, branchId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canManageBusiness(access.role)) {
    return NextResponse.json(
      { error: "Business owner access required" },
      { status: 403 }
    )
  }

  const deleted = await deleteBranch(businessId, branchId)
  if (!deleted)
    return NextResponse.json({ error: "Branch not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}