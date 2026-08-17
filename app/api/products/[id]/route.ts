import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { productInputSchema } from "@/lib/product-schema"
import { getWorkspace } from "@/lib/workspace"
import {
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/lib/product-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch first." },
      { status: 409 }
    )
  }

  const { id } = await context.params
  const result = await getProduct(user.id, workspace.businessId, id)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ product: result.data })
}

export async function PUT(request: Request, context: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch first." },
      { status: 409 }
    )
  }

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = productInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await updateProduct(
    user.id,
    workspace.businessId,
    id,
    parsed.data
  )
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ product: result.data })
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch first." },
      { status: 409 }
    )
  }

  const { id } = await context.params
  const result = await deleteProduct(user.id, workspace.businessId, id)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
