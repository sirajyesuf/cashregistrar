import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { hashInviteToken } from "@/lib/invitation"

export const runtime = "nodejs"

type Context = { params: Promise<{ token: string }> }

export async function GET(_request: Request, { params }: Context) {
  const { token } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      branchId: true,
      business: { select: { id: true, name: true } },
      branch: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  })

  if (!invitation) {
    return NextResponse.json({ valid: false, error: "invalid" })
  }

  if (invitation.status === "PENDING" && invitation.expiresAt.getTime() < Date.now()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    })
  }

  const status =
    invitation.status === "PENDING" && invitation.expiresAt.getTime() < Date.now()
      ? "EXPIRED"
      : invitation.status

  return NextResponse.json({
    valid: status === "PENDING",
    error: status === "PENDING" ? undefined : status.toLowerCase(),
    invite: {
      email: invitation.email,
      role: invitation.role,
      businessName: invitation.business.name,
      branchName: invitation.branch?.name ?? null,
      invitedByName: invitation.invitedBy.name,
    },
  })
}
