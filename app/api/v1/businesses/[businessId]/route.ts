import { NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/api-key"
import { businessUpdateApiSchema } from "@/lib/business-schema"
import {
  deleteBusiness,
  getBusinessDetail,
  updateBusiness,
} from "@/lib/business-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

  const { businessId } = await params
  const result = await getBusinessDetail(auth.userId, businessId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data)
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

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

  const result = await updateBusiness(auth.userId, businessId, parsed.data)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ business: result.data })
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

  const { businessId } = await params
  const result = await deleteBusiness(auth.userId, businessId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
