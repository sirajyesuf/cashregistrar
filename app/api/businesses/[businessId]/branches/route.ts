import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { branchInternalCreateSchema } from "@/lib/validation/internal/business"
import { canManageBusiness, getBusinessAccess } from "@/lib/business"
import { withService } from "@/lib/api-error"
import { createBranch, listBranches } from "@/lib/services/business.service"
import { toInternalBranch } from "@/lib/dto/internal/branch.dto"

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
  const branches = await listBranches(businessId, scopedBranchId)
  return NextResponse.json({ branches: branches.map(toInternalBranch) })
}

export async function POST(request: Request, { params }: Context) {
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

  const parsed = branchInternalCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await withService(() =>
    createBranch(businessId, parsed.data)
  )
  if ("error" in result) return result.error
  return NextResponse.json({ branch: toInternalBranch(result.data) }, { status: 201 })
}