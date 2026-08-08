import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { isPrismaUniqueError } from "@/lib/business"

export const runtime = "nodejs"

const createBusinessSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional(),
  currency: z.string().trim().length(3).toUpperCase().default("ETB"),
})

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const businesses = await prisma.business.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      currency: true,
      active: true,
      createdAt: true,
      _count: { select: { branches: true, members: true } },
      members: {
        where: { userId: user.id },
        select: { role: true, branchId: true },
        take: 1,
      },
    },
  })

  return NextResponse.json({ businesses })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createBusinessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  try {
    const business = await prisma.$transaction(async (tx) => {
      const createdBusiness = await tx.business.create({
        data: { ...parsed.data, ownerId: user.id },
      })
      const branch = await tx.branch.create({
        data: { businessId: createdBusiness.id, name: "Main Branch" },
      })
      await tx.businessMember.create({
        data: {
          userId: user.id,
          businessId: createdBusiness.id,
          role: "OWNER",
        },
      })

      return { ...createdBusiness, branches: [branch] }
    })

    return NextResponse.json({ business }, { status: 201 })
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        { error: "A business with this information already exists" },
        { status: 409 }
      )
    }
    throw error
  }
}
