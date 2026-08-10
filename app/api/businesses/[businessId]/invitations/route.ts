import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { canManageMembers, getBusinessAccess } from "@/lib/business"
import { prisma } from "@/lib/db"
import {
  buildInviteUrl,
  generateInviteToken,
  hashInviteToken,
  invitationCreateSchema,
  invitationExpiry,
} from "@/lib/invitation"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canManageMembers(access.role)) {
    return NextResponse.json({ error: "Business owner access required" }, { status: 403 })
  }

  const invitations = await prisma.invitation.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      branchId: true,
      createdAt: true,
      expiresAt: true,
      acceptedAt: true,
      branch: { select: { id: true, name: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
      acceptedBy: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ invitations })
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

  const parsed = invitationCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const { email, role, branchId } = parsed.data

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId },
    select: { id: true },
  })
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 400 })

  const existingMember = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      memberships: { where: { businessId }, select: { id: true } },
    },
  })
  if (existingMember?.memberships.length) {
    return NextResponse.json(
      { error: "This person is already a member of this business" },
      { status: 409 }
    )
  }

  await prisma.invitation.updateMany({
    where: { businessId, email, status: "PENDING" },
    data: { status: "CANCELLED" },
  })

  const token = generateInviteToken()
  const invitation = await prisma.invitation.create({
    data: {
      businessId,
      branchId,
      email,
      role,
      tokenHash: hashInviteToken(token),
      expiresAt: invitationExpiry(),
      invitedById: user.id,
    },
    select: {
      id: true,
      email: true,
      role: true,
      branchId: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      branch: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(
    { invitation, link: buildInviteUrl(token) },
    { status: 201 }
  )
}
