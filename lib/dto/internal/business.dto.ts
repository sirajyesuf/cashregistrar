import type { Role } from "@prisma/client"
import type {
  BusinessDetail,
  MemberBusiness,
} from "@/lib/services/business.service"

export type InternalListedBusiness = {
  id: string
  name: string
  currency: string
  active: boolean
  createdAt: Date
  _count: { branches: number; members: number }
  role: Role | null
  branchId: string | null
  branches: {
    id: string
    name: string
    businessId: string
    active: boolean
  }[]
}

export function toInternalBusinessList(
  business: MemberBusiness
): InternalListedBusiness {
  const { members, ...rest } = business
  return {
    ...rest,
    role: members[0]?.role ?? null,
    branchId: members[0]?.branchId ?? null,
  }
}

export type InternalBusinessDetail = {
  business: BusinessDetail
  role: Role
  branchId: string | null
}

export function toInternalBusinessDetail(
  detail: BusinessDetail,
  access: { role: Role; branchId: string | null }
): InternalBusinessDetail {
  const revealSecrets = access.role === "OWNER"
  const morCredential = detail.morCredential
    ? {
        ...detail.morCredential,
        clientId: revealSecrets ? detail.morCredential.clientId : "",
        clientSecret: revealSecrets ? detail.morCredential.clientSecret : "",
        apiKey: revealSecrets ? detail.morCredential.apiKey : "",
      }
    : null
  return {
    business: { ...detail, morCredential },
    role: access.role,
    branchId: access.branchId,
  }
}

export type InternalCreatedBusiness = {
  id: string
  branches: { id: string }[]
}

export function toInternalCreatedBusiness(business: {
  id: string
  branches: { id: string }[]
}): InternalCreatedBusiness {
  return { id: business.id, branches: business.branches }
}