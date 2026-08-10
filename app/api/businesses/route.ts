import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { createBusinessApiSchema } from "@/lib/business-schema"
import { prisma } from "@/lib/db"
import { isPrismaUniqueError } from "@/lib/business"

export const runtime = "nodejs"

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

  const branchFilter = businesses.map((business) => {
    const member = business.members[0]
    if (member?.role === "OWNER") return { businessId: business.id }
    return { businessId: business.id, id: member?.branchId ?? "__none__" }
  })
  const branches = await prisma.branch.findMany({
    where: { OR: branchFilter },
    orderBy: { name: "asc" },
    select: { id: true, name: true, businessId: true, active: true },
  })
  const branchesByBusiness = new Map<string, typeof branches>()
  for (const branch of branches) {
    const list = branchesByBusiness.get(branch.businessId) ?? []
    list.push(branch)
    branchesByBusiness.set(branch.businessId, list)
  }

  return NextResponse.json({
    businesses: businesses.map(({ members, ...business }) => ({
      ...business,
      role: members[0]?.role ?? null,
      branchId: members[0]?.branchId ?? null,
      branches: branchesByBusiness.get(business.id) ?? [],
    })),
  })
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

  const parsed = createBusinessApiSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  try {
    const business = await prisma.$transaction(async (tx) => {
      const createdBusiness = await tx.business.create({
        data: {
          name: parsed.data.name,
          address: parsed.data.address || null,
          ownerId: user.id,
        },
      })
      await tx.morCredential.create({
        data: {
          businessId: createdBusiness.id,
          ...parsed.data.morCredential,
        },
      })
      const branch = await tx.branch.create({
        data: {
          businessId: createdBusiness.id,
          name: parsed.data.branch?.name?.trim() || "Main Branch",
          address: parsed.data.branch?.address || null,
        },
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
