import { Prisma, Role } from "@prisma/client"
import { prisma } from "@/lib/db"

export const businessRoles = ["OWNER", "MANAGER", "CASHIER"] as const

export type BusinessAccess = {
  userId: string
  businessId: string
  role: Role
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

export function canManageBusiness(role: Role) {
  return role === Role.OWNER
}

export function canManageBranch(role: Role) {
  return role === Role.OWNER || role === Role.MANAGER
}

export function canManageMembers(role: Role) {
  return role === Role.OWNER
}

export function canAccessBranch(
  access: BusinessAccess,
  branchId: string
): boolean {
  return access.role === Role.OWNER || access.branchId === branchId
}

/**
 * Builds a branch-scoping where-clause for tenant data. Owners span all
 * branches unless an explicit branch is requested; non-owners are always
 * confined to their assigned branch. Callers must verify `canAccessBranch`
 * separately when a caller-supplied branchId could be out of scope.
 */
export function accessibleBranchWhere(
  access: BusinessAccess,
  branchId?: string | null
): { branchId?: string } {
  if (branchId) return { branchId }
  if (access.role === Role.OWNER) return {}
  return { branchId: access.branchId ?? "__none__" }
}

export function isPrismaUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  )
}
