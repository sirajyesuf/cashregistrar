import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { canManageMembers, getBusinessAccess } from "@/lib/business"
import { prisma } from "@/lib/db"
import { buildInviteUrl, generateInviteToken, hashInviteToken } from "@/lib/invitation"

export const runtime = "nodejs"

type Context = {
  params: Promise<{ businessId: string; invitationId: string }>
}

export async function POST(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, invitationId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canManageMembers(access.role)) {
    return NextResponse.json({ error: "Business owner access required" }, { status: 403 })
  }

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, businessId },
    select: { id: true, status: true, expiresAt: true },
  })
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
  }
  if (invitation.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only pending invitations can be copied" },
      { status: 400 }
    )
  }

  const token = generateInviteToken()
  await prisma.invitation.update({
    where: { id: invitationId },
    data: { tokenHash: hashInviteToken(token) },
  })

  return NextResponse.json({ link: buildInviteUrl(token) })
}
