import type { Product } from "@prisma/client"

export type PublicProduct = {
  id: string
  name: string
  itemCode: string | null
  unit: string
  price: Product["sellingPrice"]
}

export function toPublicProduct(product: Product): PublicProduct {
  return {
    id: product.id,
    name: product.name,
    itemCode: product.itemCode,
    unit: product.unit,
    price: product.sellingPrice,
  }
}