import type { Role } from "@prisma/client"
import { prisma } from "@/lib/db"

// System-wide EIMS counters are not per-workspace. The Counter model requires
// businessId/branchId (no FK constraints), so store them under sentinel keys.
export const SYSTEM_COUNTER = {
  businessId: "__system__",
  branchId: "__eims__",
} as const

export type WorkspaceSelection = { businessId: string; branchId: string }

export type WorkspaceAccess = WorkspaceSelection & {
  role: Role
}

/**
 * Prisma where-clause that scopes tenant data to the user's active workspace.
 * The branch is the workspace, so data is always scoped to the selected
 * business AND branch — for owners and members alike.
 */
export function workspaceInvoiceScope(workspace: WorkspaceAccess) {
  return {
    businessId: workspace.businessId,
    branchId: workspace.branchId,
  }
}

/** Whether the user can access a specific invoice within their workspace. */
export function canAccessInvoice(
  workspace: WorkspaceAccess,
  invoice: { businessId: string; branchId: string }
): boolean {
  return (
    invoice.businessId === workspace.businessId &&
    invoice.branchId === workspace.branchId
  )
}

/**
 * Resolves and authorizes an explicit workspace for a user. The caller must
 * pass the ids — never the persisted preference — so data queries are a pure
 * function of their cache key.
 */
export async function getWorkspaceAccess(
  userId: string,
  businessId: string,
  branchId: string
): Promise<WorkspaceAccess | null> {
  const member = await prisma.businessMember.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { role: true, branchId: true },
  })
  if (!member) return null
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId, active: true },
    select: { id: true },
  })
  if (!branch) return null
  if (member.role === "OWNER") {
    return { businessId, branchId, role: member.role }
  }
  if (member.branchId !== branchId) return null
  return { businessId, branchId, role: member.role }
}

export async function canAccessWorkspace(
  userId: string,
  businessId: string,
  branchId: string
): Promise<boolean> {
  return (await getWorkspaceAccess(userId, businessId, branchId)) !== null
}

/** Persists the user's active workspace. */
export async function saveWorkspace(
  userId: string,
  businessId: string,
  branchId: string
): Promise<void> {
  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, businessId, branchId },
    update: { businessId, branchId },
  })
}

/**
 * Returns the validated active workspace for the user. Prefers the saved
 * preference; otherwise falls back to the user's first active business and
 * (for owners) its first branch or (for members) their assigned branch.
 */
export async function getWorkspace(
  userId: string
): Promise<WorkspaceAccess | null> {
  const preference = await prisma.userPreference.findUnique({
    where: { userId },
    select: { businessId: true, branchId: true },
  })

  if (
    preference?.businessId &&
    preference.branchId &&
    (await canAccessWorkspace(userId, preference.businessId, preference.branchId))
  ) {
    const member = await prisma.businessMember.findUnique({
      where: {
        userId_businessId: { userId, businessId: preference.businessId },
      },
      select: { role: true },
    })
    if (member) {
      return {
        businessId: preference.businessId,
        branchId: preference.branchId,
        role: member.role,
      }
    }
  }

  const memberships = await prisma.businessMember.findMany({
    where: { userId },
    select: { businessId: true, branchId: true, role: true },
    orderBy: { createdAt: "asc" },
  })
  for (const membership of memberships) {
    const business = await prisma.business.findFirst({
      where: { id: membership.businessId, active: true },
      select: { id: true },
    })
    if (!business) continue

    if (membership.role === "OWNER") {
      const branch = await prisma.branch.findFirst({
        where: { businessId: membership.businessId, active: true },
        orderBy: { name: "asc" },
        select: { id: true },
      })
      if (branch) {
        return {
          businessId: membership.businessId,
          branchId: branch.id,
          role: membership.role,
        }
      }
      continue
    }

    if (membership.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: membership.branchId, active: true },
        select: { id: true },
      })
      if (branch) {
        return {
          businessId: membership.businessId,
          branchId: membership.branchId,
          role: membership.role,
        }
      }
    }
  }

  return null
}
