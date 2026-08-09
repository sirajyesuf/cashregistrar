import { cookies } from "next/headers"
import type { Role } from "@prisma/client"
import { prisma } from "@/lib/db"

export const WORKSPACE_COOKIE = "cashreg_workspace"

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
 * Prisma where-clause that scopes tenant data to the user's workspace:
 * owners see every branch in the business, members only their assigned branch.
 */
export function workspaceInvoiceScope(workspace: WorkspaceAccess) {
  return workspace.role === "OWNER"
    ? { businessId: workspace.businessId }
    : { businessId: workspace.businessId, branchId: workspace.branchId }
}

/** Whether the user can access a specific invoice within their workspace. */
export function canAccessInvoice(
  workspace: WorkspaceAccess,
  invoice: { businessId: string; branchId: string }
): boolean {
  if (invoice.businessId !== workspace.businessId) return false
  if (workspace.role === "OWNER") return true
  return invoice.branchId === workspace.branchId
}

export function parseWorkspaceCookie(
  value: string | undefined
): WorkspaceSelection | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as WorkspaceSelection).businessId === "string" &&
      typeof (parsed as WorkspaceSelection).branchId === "string"
    ) {
      return {
        businessId: (parsed as WorkspaceSelection).businessId,
        branchId: (parsed as WorkspaceSelection).branchId,
      }
    }
  } catch {
    // ignore malformed cookies
  }
  return null
}

export async function canAccessWorkspace(
  userId: string,
  businessId: string,
  branchId: string
): Promise<boolean> {
  const member = await prisma.businessMember.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { role: true, branchId: true },
  })
  if (!member) return false
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId, active: true },
    select: { id: true },
  })
  if (!branch) return false
  if (member.role === "OWNER") return true
  return branchId === member.branchId
}

/**
 * Returns the validated active workspace for the user. Prefers the saved
 * cookie selection; otherwise falls back to the user's first active business
 * and (for owners) its first branch or (for members) their assigned branch.
 */
export async function getWorkspace(
  userId: string
): Promise<WorkspaceAccess | null> {
  const saved = parseWorkspaceCookie(
    (await cookies()).get(WORKSPACE_COOKIE)?.value
  )
  if (saved && (await canAccessWorkspace(userId, saved.businessId, saved.branchId))) {
    const member = await prisma.businessMember.findUnique({
      where: {
        userId_businessId: { userId, businessId: saved.businessId },
      },
      select: { role: true },
    })
    if (member) return { ...saved, role: member.role }
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
