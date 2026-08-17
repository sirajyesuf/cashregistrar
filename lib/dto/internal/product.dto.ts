import type { Product } from "@prisma/client"

export type InternalProduct = {
  id: string
  name: string
  itemCode: string | null
  unit: string
  sellingPrice: Product["sellingPrice"]
  createdAt: Date
  updatedAt: Date
}

export function toInternalProduct(product: Product): InternalProduct {
  return {
    id: product.id,
    name: product.name,
    itemCode: product.itemCode,
    unit: product.unit,
    sellingPrice: product.sellingPrice,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }
}