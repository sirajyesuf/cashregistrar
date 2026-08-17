import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { productInputSchema } from "@/lib/product-schema"
import { getWorkspace } from "@/lib/workspace"
import { createProduct, listProducts } from "@/lib/product-service"

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

  const result = await listProducts(user.id, workspace.businessId, query)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ products: result.data })
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

  const parsed = productInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await createProduct(user.id, workspace.businessId, parsed.data)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ product: result.data }, { status: 201 })
}
