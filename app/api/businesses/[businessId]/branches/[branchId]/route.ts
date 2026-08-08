import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/auth/user"
import {
  canManageBranch,
  canAccessBranch,
  getBusinessAccess,
  isPrismaUniqueError,
} from "@/lib/business"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; branchId: string }> }

const updateBranchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
  active: z.boolean().optional(),
})

export async function GET(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, branchId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canAccessBranch(access, branchId)) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 })
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId },
  })
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

  return NextResponse.json({ branch })
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId, branchId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canManageBranch(access.role) || !canAccessBranch(access, branchId)) {
    return NextResponse.json({ error: "Branch management access required" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = updateBranchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const branch = await prisma.branch.findFirst({ where: { id: branchId, businessId } })
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

  try {
    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: parsed.data,
    })
    return NextResponse.json({ branch: updatedBranch })
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
