import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { canManageBusiness, getBusinessAccess } from "@/lib/business"
import { publicErrorResponse, withService } from "@/lib/api-error"
import { productPublicSchema } from "@/lib/validation/public/product"
import {
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/lib/services/product.service"
import { toPublicProduct } from "@/lib/dto/public/product.dto"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; productId: string }> }

const notFound = () =>
  NextResponse.json(
    { error: { code: "NOT_FOUND", message: "Product not found" } },
    { status: 404 }
  )

export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, productId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access)
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Business not found" } },
      { status: 404 }
    )

  const product = await getProduct(productId, businessId)
  if (!product) return notFound()
  return NextResponse.json({ product: toPublicProduct(product) })
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, productId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access)
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Business not found" } },
      { status: 404 }
    )
  if (!canManageBusiness(access.role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Business owner access required" } },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    )
  }

  const parsed = productPublicSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues.map((issue) => issue.message).join("; "),
        },
      },
      { status: 422 }
    )
  }

  const { price, ...input } = parsed.data
  const result = await withService(
    () => updateProduct(productId, businessId, { ...input, sellingPrice: price }),
    publicErrorResponse
  )
  if ("error" in result) return result.error
  if (!result.data) return notFound()
  return NextResponse.json({ product: toPublicProduct(result.data) })
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, productId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access)
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Business not found" } },
      { status: 404 }
    )
  if (!canManageBusiness(access.role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Business owner access required" } },
      { status: 403 }
    )
  }

  const deleted = await deleteProduct(productId, businessId)
  if (!deleted) return notFound()
  return NextResponse.json({ ok: true })
}