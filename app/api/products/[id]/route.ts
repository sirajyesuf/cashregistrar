import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { productInputSchema } from "@/lib/product-schema"
import { getWorkspace } from "@/lib/workspace"

export const runtime = "nodejs"

async function requireUser() {
  const user = await getSessionUser()
  if (!user) return null
  return user
}

async function findOwnedProduct(userId: string, productId: string) {
  const workspace = await getWorkspace(userId)
  if (!workspace) return null
  return prisma.product.findFirst({
    where: { id: productId, businessId: workspace.businessId },
  })
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await context.params
  const product = await findOwnedProduct(user.id, id)
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
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

  const { name, itemCode, unit, sellingPrice } = parsed.data
  const price = new Prisma.Decimal(Math.round(sellingPrice * 100)).div(100)

  try {
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        name,
        itemCode: itemCode || null,
        unit: unit || "PCS",
        sellingPrice: price,
      },
    })
    return NextResponse.json({ product: updated })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: `A product named "${name}" already exists` },
        { status: 400 }
      )
    }
    throw err
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await context.params
  const product = await findOwnedProduct(user.id, id)
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  await prisma.product.delete({ where: { id: product.id } })
  return NextResponse.json({ ok: true })
}
