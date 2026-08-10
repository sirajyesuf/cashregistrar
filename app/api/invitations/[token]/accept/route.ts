import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"
import { hashInviteToken } from "@/lib/invitation"
import { isPrismaUniqueError } from "@/lib/business"
import { saveWorkspace } from "@/lib/workspace"

export const runtime = "nodejs"

type Context = { params: Promise<{ token: string }> }

export async function POST(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { token } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      branchId: true,
      status: true,
      expiresAt: true,
      businessId: true,
    },
  })

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
  }

  if (invitation.status === "ACCEPTED") {
    return NextResponse.json({ error: "This invitation has already been used" }, { status: 409 })
  }
  if (invitation.status === "CANCELLED") {
    return NextResponse.json({ error: "This invitation was cancelled" }, { status: 409 })
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    })
    return NextResponse.json({ error: "This invitation has expired" }, { status: 410 })
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invitation was sent to a different email address" },
      { status: 403 }
    )
  }

  if (!invitation.branchId) {
    return NextResponse.json(
      { error: "This invitation is no longer valid" },
      { status: 400 }
    )
  }

  const existingMember = await prisma.businessMember.findUnique({
    where: {
      userId_businessId: { userId: user.id, businessId: invitation.businessId },
    },
    select: { id: true },
  })
  if (existingMember) {
    return NextResponse.json(
      { error: "You are already a member of this business" },
      { status: 409 }
    )
  }

  try {
    await prisma.businessMember.create({
      data: {
        userId: user.id,
        businessId: invitation.businessId,
        branchId: invitation.branchId,
        role: invitation.role,
      },
    })
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        { error: "You are already a member of this business" },
        { status: 409 }
      )
    }
    throw error
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedByUserId: user.id, acceptedAt: new Date() },
  })

  await saveWorkspace(user.id, invitation.businessId, invitation.branchId)

  return NextResponse.json({ ok: true })
}
