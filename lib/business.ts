import { BusinessRole, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export const businessRoles = ["OWNER", "MANAGER", "CASHIER"] as const

export type BusinessAccess = {
  userId: string
  businessId: string
  role: BusinessRole
  branchId: string | null
}

export async function getBusinessAccess(
  userId: string,
  businessId: string
): Promise<BusinessAccess | null> {
  const membership = await prisma.businessMember.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { userId: true, businessId: true, role: true, branchId: true },
  })

  return membership
}

export function canManageBusiness(role: BusinessRole) {
  return role === BusinessRole.OWNER
}

export function canManageBranch(role: BusinessRole) {
  return role === BusinessRole.OWNER || role === BusinessRole.MANAGER
}

export function canManageMembers(role: BusinessRole) {
  return role === BusinessRole.OWNER
}

export function canAccessBranch(
  access: BusinessAccess,
  branchId: string
): boolean {
  return access.role === BusinessRole.OWNER || access.branchId === branchId
}

export function isPrismaUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  )
}
