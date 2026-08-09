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

async function requireWorkspace(userId: string) {
  const workspace = await getWorkspace(userId)
  if (!workspace) return null
  return workspace
}

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await requireWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch first." },
      { status: 409 }
    )
  }

  const url = new URL(request.url)
  const query = url.searchParams.get("q")?.trim() ?? ""

  const products = await prisma.product.findMany({
    where: {
      businessId: workspace.businessId,
      ...(query ? { name: { contains: query } } : {}),
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ products })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await requireWorkspace(user.id)
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

  const { name, sellingPrice } = parsed.data
  const price = new Prisma.Decimal(Math.round(sellingPrice * 100)).div(100)

  try {
    const product = await prisma.product.create({
      data: { businessId: workspace.businessId, name, sellingPrice: price },
    })
    return NextResponse.json({ product }, { status: 201 })
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
