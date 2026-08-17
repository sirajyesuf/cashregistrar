import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { updateBranchSchema } from "@/lib/business-schema"
import {
  deleteBranch,
  getBranch,
  updateBranch,
} from "@/lib/business-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; branchId: string }> }

export async function GET(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, branchId } = await params
  const result = await getBranch(user.id, businessId, branchId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ branch: result.data })
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, branchId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = updateBranchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await updateBranch(user.id, businessId, branchId, parsed.data)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ branch: result.data })
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, branchId } = await params
  const result = await deleteBranch(user.id, businessId, branchId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
