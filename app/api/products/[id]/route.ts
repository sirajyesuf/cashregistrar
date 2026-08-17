import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { productInternalSchema } from "@/lib/validation/internal/product"
import { getWorkspace } from "@/lib/workspace"
import { withService } from "@/lib/api-error"
import {
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/lib/services/product.service"
import { toInternalProduct } from "@/lib/dto/internal/product.dto"

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
  const product = await getProduct(id, workspace.businessId)
  if (!product)
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  return NextResponse.json({ product: toInternalProduct(product) })
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

  const parsed = productInternalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await withService(() =>
    updateProduct(id, workspace.businessId, parsed.data)
  )
  if ("error" in result) return result.error
  if (!result.data)
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  return NextResponse.json({ product: toInternalProduct(result.data) })
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
  const deleted = await deleteProduct(id, workspace.businessId)
  if (!deleted)
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}