import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/auth/user"
import {
  businessRoles,
  canManageMembers,
  getBusinessAccess,
  isPrismaUniqueError,
} from "@/lib/business"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

const addMemberSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(businessRoles).default("CASHIER"),
  branchId: z.string().trim().min(1).nullable().optional(),
})

export async function GET(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const members = await prisma.businessMember.findMany({
    where: {
      businessId,
      ...(access.role === "OWNER"
        ? {}
        : { branchId: access.branchId ?? "__no_branch_access__" }),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      branchId: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ members })
}

export async function POST(request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canManageMembers(access.role)) {
    return NextResponse.json({ error: "Business owner access required" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = addMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  if (parsed.data.role === "OWNER") {
    return NextResponse.json(
      { error: "A business can only have one owner" },
      { status: 400 }
    )
  }

  if (!parsed.data.branchId) {
    return NextResponse.json(
      { error: "Managers and cashiers must be assigned to a branch" },
      { status: 400 }
    )
  }

  if (parsed.data.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: parsed.data.branchId, businessId },
      select: { id: true },
    })
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 400 })
    }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  })
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  try {
    const member = await prisma.businessMember.create({
      data: {
        userId: parsed.data.userId,
        businessId,
        role: parsed.data.role,
        branchId: parsed.data.branchId,
      },
      select: {
        id: true,
        role: true,
        branchId: true,
        user: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        { error: "User is already a member of this business" },
        { status: 409 }
      )
    }
    throw error
  }
}
