import type { MemberBusiness, BusinessDetail } from "@/lib/services/business.service"

export type PublicBusiness = {
  id: string
  ownerId: string
  name: string
  address: string | null
  currency: string
  active: boolean
  city: string
  country: string
  email: string | null
  phone: string | null
  region: string | null
  wereda: string | null
  houseNumber: string | null
  createdAt: Date
  updatedAt: Date
}

export function toPublicBusiness(business: MemberBusiness): PublicBusiness {
  return {
    id: business.id,
    ownerId: business.ownerId,
    name: business.name,
    address: business.address,
    currency: business.currency,
    active: business.active,
    city: business.city,
    country: business.country,
    email: business.email,
    phone: business.phone,
    region: business.region,
    wereda: business.wereda,
    houseNumber: business.houseNumber,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  }
}

export type PublicBusinessDetail = {
  business: BusinessDetail
}

export function toPublicBusinessDetail(detail: BusinessDetail): PublicBusinessDetail {
  return { business: detail }
}

export type PublicCreatedBusiness = {
  id: string
  branches: { id: string }[]
}

export function toPublicCreatedBusiness(business: {
  id: string
  branches: { id: string }[]
}): PublicCreatedBusiness {
  return { id: business.id, branches: business.branches }
}