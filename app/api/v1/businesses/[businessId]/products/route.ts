import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { canManageBusiness, getBusinessAccess } from "@/lib/business"
import { publicErrorResponse, withService } from "@/lib/api-error"
import { productPublicSchema } from "@/lib/validation/public/product"
import { createProduct, listProducts } from "@/lib/services/product.service"
import { toPublicProduct } from "@/lib/dto/public/product.dto"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access)
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Business not found" } },
      { status: 404 }
    )

  const url = new URL(request.url)
  const query = url.searchParams.get("q")?.trim() ?? ""

  const products = await listProducts(businessId, query)
  return NextResponse.json({ products: products.map(toPublicProduct) })
}

export async function POST(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId } = await params
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
    () => createProduct(businessId, { ...input, sellingPrice: price }),
    publicErrorResponse
  )
  if ("error" in result) return result.error
  return NextResponse.json({ product: toPublicProduct(result.data) }, { status: 201 })
}