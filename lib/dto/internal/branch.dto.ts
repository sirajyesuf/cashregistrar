import type { Branch } from "@prisma/client"

export type InternalBranch = {
  id: string
  businessId: string
  name: string
  address: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export function toInternalBranch(branch: Branch): InternalBranch {
  return {
    id: branch.id,
    businessId: branch.businessId,
    name: branch.name,
    address: branch.address,
    active: branch.active,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  }
}