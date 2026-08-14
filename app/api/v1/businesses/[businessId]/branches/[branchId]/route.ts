import { NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/api-key"
import { updateBranchSchema } from "@/lib/business-schema"
import {
  deleteBranch,
  getBranch,
  updateBranch,
} from "@/lib/business-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; branchId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

  const { businessId, branchId } = await params
  const result = await getBranch(auth.userId, businessId, branchId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ branch: result.data })
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

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

  const result = await updateBranch(auth.userId, businessId, branchId, parsed.data)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ branch: result.data })
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

  const { businessId, branchId } = await params
  const result = await deleteBranch(auth.userId, businessId, branchId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
