import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { productInternalSchema } from "@/lib/validation/internal/product"
import { getWorkspace } from "@/lib/workspace"
import { withService } from "@/lib/api-error"
import { createProduct, listProducts } from "@/lib/services/product.service"
import { toInternalProduct } from "@/lib/dto/internal/product.dto"

export const runtime = "nodejs"

export async function GET(request: Request) {
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

  const url = new URL(request.url)
  const query = url.searchParams.get("q")?.trim() ?? ""

  const products = await listProducts(workspace.businessId, query)
  return NextResponse.json({ products: products.map(toInternalProduct) })
}

export async function POST(request: Request) {
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
    createProduct(workspace.businessId, parsed.data)
  )
  if ("error" in result) return result.error
  return NextResponse.json(
    { product: toInternalProduct(result.data) },
    { status: 201 }
  )
}