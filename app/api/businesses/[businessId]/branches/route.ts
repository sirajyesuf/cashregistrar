import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import {
  canManageBusiness,
  getBusinessAccess,
  isPrismaUniqueError,
} from "@/lib/business"
import { branchCreateSchema } from "@/lib/business-schema"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const branches = await prisma.branch.findMany({
    where: {
      businessId,
      ...(access.role === "OWNER"
        ? {}
        : { id: access.branchId ?? "__no_branch_access__" }),
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ branches })
}

export async function POST(request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canManageBusiness(access.role)) {
    return NextResponse.json({ error: "Business owner access required" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = branchCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  try {
    const branch = await prisma.branch.create({
      data: {
        name: parsed.data.name,
        address: parsed.data.address || null,
        businessId,
      },
    })
    return NextResponse.json({ branch }, { status: 201 })
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        { error: "A branch with this name already exists in the business" },
        { status: 409 }
      )
    }
    throw error
  }
}
