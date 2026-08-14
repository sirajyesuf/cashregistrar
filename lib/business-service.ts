import type { Business, Branch, Role } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  canAccessBranch,
  canManageBranch,
  canManageBusiness,
  getBusinessAccess,
  isPrismaUniqueError,
} from "@/lib/business"
import { forbidden, notFound, type ServiceResult } from "@/lib/service"
import type {
  BranchCreateValues,
  BranchUpdateValues,
  BusinessUpdateValues,
  CreateBusinessApiValues,
} from "@/lib/business-schema"

type BranchSummary = {
  id: string
  name: string
  businessId: string
  active: boolean
}

export type ListedBusiness = {
  id: string
  name: string
  currency: string
  active: boolean
  createdAt: Date
  _count: { branches: number; members: number }
  role: Role | null
  branchId: string | null
  branches: BranchSummary[]
}

export async function createBusiness(
  userId: string,
  input: CreateBusinessApiValues
): Promise<ServiceResult<Business & { branches: Branch[] }>> {
  try {
    const business = await prisma.$transaction(async (tx) => {
      const createdBusiness = await tx.business.create({
        data: {
          name: input.name,
          address: input.address || null,
          ownerId: userId,
          city: input.city ?? "",
          email: input.email ?? null,
          phone: input.phone ?? null,
          region: input.region || null,
          wereda: input.wereda ?? null,
          country: input.country ?? "",
          houseNumber: input.houseNumber ?? null,
        },
      })
      await tx.morCredential.create({
        data: {
          businessId: createdBusiness.id,
          ...input.morCredential,
        },
      })
      const branch = await tx.branch.create({
        data: {
          businessId: createdBusiness.id,
          name: input.branch?.name?.trim() || "Main Branch",
          address: input.branch?.address || null,
        },
      })
      await tx.businessMember.create({
        data: {
          userId,
          businessId: createdBusiness.id,
          role: "OWNER",
        },
      })

      return { ...createdBusiness, branches: [branch] }
    })

    return { ok: true, data: business }
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return {
        ok: false,
        status: 409,
        error: "A business with this information already exists",
      }
    }
    throw error
  }
}

export async function listUserBusinesses(
  userId: string
): Promise<ServiceResult<ListedBusiness[]>> {
  const businesses = await prisma.business.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      currency: true,
      active: true,
      createdAt: true,
      _count: { select: { branches: true, members: true } },
      members: {
        where: { userId },
        select: { role: true, branchId: true },
        take: 1,
      },
    },
  })

  const branchFilter = businesses.map((business) => {
    const member = business.members[0]
    if (member?.role === "OWNER") return { businessId: business.id }
    return { businessId: business.id, id: member?.branchId ?? "__none__" }
  })
  const branches = await prisma.branch.findMany({
    where: { OR: branchFilter },
    orderBy: { name: "asc" },
    select: { id: true, name: true, businessId: true, active: true },
  })
  const branchesByBusiness = new Map<string, typeof branches>()
  for (const branch of branches) {
    const list = branchesByBusiness.get(branch.businessId) ?? []
    list.push(branch)
    branchesByBusiness.set(branch.businessId, list)
  }

  return {
    ok: true as const,
    data: businesses.map(({ members, ...business }) => ({
      ...business,
      role: members[0]?.role ?? null,
      branchId: members[0]?.branchId ?? null,
      branches: branchesByBusiness.get(business.id) ?? [],
    })),
  }
}

export async function getBusinessDetail(userId: string, businessId: string) {
  const access = await getBusinessAccess(userId, businessId)
  if (!access) return notFound("Business not found")

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      address: true,
      currency: true,
      active: true,
      city: true,
      email: true,
      phone: true,
      region: true,
      wereda: true,
      country: true,
      houseNumber: true,
      createdAt: true,
      morCredential: {
        select: {
          tin: true,
          vatNumber: true,
          systemNumber: true,
          systemType: true,
          clientId: true,
          clientSecret: true,
          apiKey: true,
        },
      },
      branches: {
        where:
          access.role === "OWNER"
            ? undefined
            : { id: access.branchId ?? "__no_branch_access__" },
        orderBy: { name: "asc" },
      },
    },
  })

  if (!business) return notFound("Business not found")

  const { morCredential, ...rest } = business
  const revealSecrets = access.role === "OWNER"
  return {
    ok: true as const,
    data: {
      business: {
        ...rest,
        morCredential: morCredential
          ? {
              ...morCredential,
              clientId: revealSecrets ? morCredential.clientId : "",
              clientSecret: revealSecrets ? morCredential.clientSecret : "",
              apiKey: revealSecrets ? morCredential.apiKey : "",
            }
          : null,
      },
      role: access.role,
      branchId: access.branchId,
    },
  }
}

export async function updateBusiness(
  userId: string,
  businessId: string,
  input: BusinessUpdateValues
): Promise<ServiceResult<Business>> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access || !canManageBusiness(access.role)) {
    return forbidden("Business owner access required")
  }

  const { morCredential, ...businessData } = input
  const business = await prisma.$transaction(async (tx) => {
    const updated = await tx.business.update({
      where: { id: businessId },
      data: businessData,
    })
    if (morCredential) {
      await tx.morCredential.upsert({
        where: { businessId },
        create: {
          businessId,
          ...(morCredential as Required<typeof morCredential>),
        },
        update: morCredential,
      })
    }
    return updated
  })
  return { ok: true, data: business }
}

export async function deleteBusiness(userId: string, businessId: string) {
  const access = await getBusinessAccess(userId, businessId)
  if (!access || !canManageBusiness(access.role)) {
    return forbidden("Business owner access required")
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { active: false },
  })
  return { ok: true as const, data: { id: businessId } }
}

export async function listBranches(userId: string, businessId: string) {
  const access = await getBusinessAccess(userId, businessId)
  if (!access) return notFound("Business not found")

  const branches = await prisma.branch.findMany({
    where: {
      businessId,
      ...(access.role === "OWNER"
        ? {}
        : { id: access.branchId ?? "__no_branch_access__" }),
    },
    orderBy: { name: "asc" },
  })

  return { ok: true as const, data: branches }
}

export async function createBranch(
  userId: string,
  businessId: string,
  input: BranchCreateValues
): Promise<ServiceResult<Branch>> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access || !canManageBusiness(access.role)) {
    return forbidden("Business owner access required")
  }

  try {
    const branch = await prisma.branch.create({
      data: {
        name: input.name,
        address: input.address || null,
        businessId,
      },
    })
    return { ok: true, data: branch }
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return {
        ok: false,
        status: 409,
        error: "A branch with this name already exists in the business",
      }
    }
    throw error
  }
}

export async function getBranch(
  userId: string,
  businessId: string,
  branchId: string
) {
  const access = await getBusinessAccess(userId, businessId)
  if (!access || !canAccessBranch(access, branchId)) {
    return notFound("Branch not found")
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId },
  })
  if (!branch) return notFound("Branch not found")

  return { ok: true as const, data: branch }
}

export async function updateBranch(
  userId: string,
  businessId: string,
  branchId: string,
  input: BranchUpdateValues
): Promise<ServiceResult<Branch>> {
  const access = await getBusinessAccess(userId, businessId)
  if (
    !access ||
    !canManageBranch(access.role) ||
    !canAccessBranch(access, branchId)
  ) {
    return forbidden("Branch management access required")
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId },
  })
  if (!branch) return notFound("Branch not found")

  try {
    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: input,
    })
    return { ok: true, data: updatedBranch }
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return {
        ok: false,
        status: 409,
        error: "A branch with this name already exists in the business",
      }
    }
    throw error
  }
}

export async function deleteBranch(
  userId: string,
  businessId: string,
  branchId: string
) {
  const access = await getBusinessAccess(userId, businessId)
  if (!access || !canManageBusiness(access.role)) {
    return forbidden("Business owner access required")
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId },
  })
  if (!branch) return notFound("Branch not found")

  await prisma.branch.update({
    where: { id: branchId },
    data: { active: false },
  })
  return { ok: true as const, data: { id: branchId } }
}
