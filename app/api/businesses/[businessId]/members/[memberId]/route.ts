import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/auth/user"
import {
  canManageMembers,
  getBusinessAccess,
} from "@/lib/business"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; memberId: string }> }

const updateMemberSchema = z.object({
  role: z.enum(["MANAGER", "CASHIER"] as const).optional(),
  branchId: z.string().trim().min(1).nullable().optional(),
})

export async function PATCH(request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, memberId } = await params
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

  const parsed = updateMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const member = await prisma.businessMember.findFirst({
    where: { id: memberId, businessId },
    select: { id: true, role: true, branchId: true },
  })
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })

  if (member.role === "OWNER") {
    return NextResponse.json({ error: "The owner cannot be changed here" }, { status: 400 })
  }

  const nextBranchId =
    parsed.data.branchId === undefined ? member.branchId : parsed.data.branchId
  if (!nextBranchId) {
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
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 400 })
  }

  const updatedMember = await prisma.businessMember.update({
    where: { id: memberId },
    data: parsed.data,
    select: {
      id: true,
      role: true,
      branchId: true,
      user: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ member: updatedMember })
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, memberId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canManageMembers(access.role)) {
    return NextResponse.json({ error: "Business owner access required" }, { status: 403 })
  }

  const member = await prisma.businessMember.findFirst({
    where: { id: memberId, businessId },
    select: { id: true, role: true },
  })
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })
  if (member.role === "OWNER") {
    return NextResponse.json({ error: "The owner cannot be removed" }, { status: 400 })
  }

  await prisma.businessMember.delete({ where: { id: memberId } })
  return NextResponse.json({ ok: true })
}
