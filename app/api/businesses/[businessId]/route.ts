import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { businessUpdateApiSchema } from "@/lib/business-schema"
import {
  deleteBusiness,
  getBusinessDetail,
  updateBusiness,
} from "@/lib/business-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const result = await getBusinessDetail(user.id, businessId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data)
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = businessUpdateApiSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await updateBusiness(user.id, businessId, parsed.data)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ business: result.data })
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const result = await deleteBusiness(user.id, businessId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
