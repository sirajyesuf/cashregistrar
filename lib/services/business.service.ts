import type { Branch, Business, Role } from "@prisma/client"
import { prisma } from "@/lib/db"
import { isPrismaUniqueError } from "@/lib/business"
import { ConflictError } from "@/lib/api-error"
import type {
  BranchCreateValues,
  BranchUpdateValues,
  BusinessUpdateValues,
  CreateBusinessApiValues,
} from "@/lib/business-schema"

export type BranchSummary = {
  id: string
  name: string
  businessId: string
  active: boolean
}

export type MemberBusiness = Business & {
  _count: { branches: number; members: number }
  members: { role: Role; branchId: string | null }[]
  branches: BranchSummary[]
}

export type BusinessDetail = Business & {
  morCredential: {
    tin: string
    vatNumber: string
    systemNumber: string
    systemType: string
    clientId: string
    clientSecret: string
    apiKey: string
  } | null
  branches: Branch[]
}

export async function createBusiness(
  userId: string,
  input: CreateBusinessApiValues
): Promise<Business & { branches: Branch[] }> {
  try {
    return await prisma.$transaction(async (tx) => {
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
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw new ConflictError("A business with this information already exists")
    }
    throw error
  }
}

export async function listUserBusinesses(
  userId: string,
  opts: { ownerOnly?: boolean } = {}
): Promise<MemberBusiness[]> {
  const businesses = await prisma.business.findMany({
    where: {
      ...(opts.ownerOnly
        ? { ownerId: userId }
        : { members: { some: { userId } } }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ownerId: true,
      name: true,
      address: true,
      currency: true,
      active: true,
      city: true,
      country: true,
      email: true,
      phone: true,
      region: true,
      wereda: true,
      houseNumber: true,
      createdAt: true,
      updatedAt: true,
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

  return businesses.map((business) => ({
    ...business,
    branches: branchesByBusiness.get(business.id) ?? [],
  }))
}

export async function getBusinessDetail(
  businessId: string,
  scopedBranchId?: string | null
): Promise<BusinessDetail | null> {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      address: true,
      currency: true,
      active: true,
      city: true,
      country: true,
      email: true,
      phone: true,
      region: true,
      wereda: true,
      houseNumber: true,
      createdAt: true,
      updatedAt: true,
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
        where: scopedBranchId ? { id: scopedBranchId } : undefined,
        orderBy: { name: "asc" },
      },
    },
  })
}

export async function updateBusiness(
  businessId: string,
  input: BusinessUpdateValues
): Promise<Business> {
  const { morCredential, ...businessData } = input
  return prisma.$transaction(async (tx) => {
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
}

export async function deleteBusiness(businessId: string): Promise<{ id: string }> {
  await prisma.business.update({
    where: { id: businessId },
    data: { active: false },
  })
  return { id: businessId }
}

export async function listBranches(
  businessId: string,
  scopedBranchId?: string | null
): Promise<Branch[]> {
  return prisma.branch.findMany({
    where: {
      businessId,
      ...(scopedBranchId ? { id: scopedBranchId } : {}),
    },
    orderBy: { name: "asc" },
  })
}

export async function createBranch(
  businessId: string,
  input: BranchCreateValues
): Promise<Branch> {
  try {
    return await prisma.branch.create({
      data: {
        name: input.name,
        address: input.address || null,
        businessId,
      },
    })
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw new ConflictError(
        "A branch with this name already exists in the business"
      )
    }
    throw error
  }
}

export async function getBranch(
  businessId: string,
  branchId: string
): Promise<Branch | null> {
  return prisma.branch.findFirst({
    where: { id: branchId, businessId },
  })
}

export async function updateBranch(
  businessId: string,
  branchId: string,
  input: BranchUpdateValues
): Promise<Branch | null> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId },
  })
  if (!branch) return null

  try {
    return await prisma.branch.update({
      where: { id: branchId },
      data: input,
    })
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw new ConflictError(
        "A branch with this name already exists in the business"
      )
    }
    throw error
  }
}

export async function deleteBranch(
  businessId: string,
  branchId: string
): Promise<{ id: string } | null> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId },
  })
  if (!branch) return null

  await prisma.branch.update({
    where: { id: branchId },
    data: { active: false },
  })
  return { id: branchId }
}