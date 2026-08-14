import { NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/api-key"
import { productInputSchema } from "@/lib/product-schema"
import {
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/lib/product-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; productId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

  const { businessId, productId } = await params
  const result = await getProduct(auth.userId, businessId, productId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ product: result.data })
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

  const { businessId, productId } = await params

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
    auth.userId,
    businessId,
    productId,
    parsed.data
  )
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ product: result.data })
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticateApiKey(request)
  if (!auth)
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )

  const { businessId, productId } = await params
  const result = await deleteProduct(auth.userId, businessId, productId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
