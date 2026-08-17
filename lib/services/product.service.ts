import { Prisma } from "@prisma/client"
import type { Product } from "@prisma/client"
import { prisma } from "@/lib/db"
import { isPrismaUniqueError } from "@/lib/business"
import { ConflictError } from "@/lib/api-error"
import type { Unit } from "@/lib/units"

export type ProductServiceInput = {
  name: string
  itemCode?: string
  unit?: Unit
  sellingPrice: number
}

function normalizePrice(sellingPrice: number): Prisma.Decimal {
  return new Prisma.Decimal(Math.round(sellingPrice * 100)).div(100)
}

export async function listProducts(
  businessId: string,
  query?: string
): Promise<Product[]> {
  return prisma.product.findMany({
    where: {
      businessId,
      ...(query ? { name: { contains: query } } : {}),
    },
    orderBy: { name: "asc" },
  })
}

export async function createProduct(
  businessId: string,
  input: ProductServiceInput
): Promise<Product> {
  const { name, itemCode, unit, sellingPrice } = input
  try {
    return await prisma.product.create({
      data: {
        businessId,
        name,
        itemCode: itemCode || null,
        unit: unit || "PCS",
        sellingPrice: normalizePrice(sellingPrice),
      },
    })
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw new ConflictError(`A product named "${name}" already exists`)
    }
    throw error
  }
}

export async function getProduct(
  productId: string,
  businessId: string
): Promise<Product | null> {
  return prisma.product.findFirst({
    where: { id: productId, businessId },
  })
}

export async function updateProduct(
  productId: string,
  businessId: string,
  input: ProductServiceInput
): Promise<Product | null> {
  const existing = await prisma.product.findFirst({
    where: { id: productId, businessId },
  })
  if (!existing) return null

  const { name, itemCode, unit, sellingPrice } = input
  try {
    return await prisma.product.update({
      where: { id: existing.id },
      data: {
        name,
        itemCode: itemCode || null,
        unit: unit || "PCS",
        sellingPrice: normalizePrice(sellingPrice),
      },
    })
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw new ConflictError(`A product named "${name}" already exists`)
    }
    throw error
  }
}

export async function deleteProduct(
  productId: string,
  businessId: string
): Promise<{ id: string } | null> {
  const existing = await prisma.product.findFirst({
    where: { id: productId, businessId },
  })
  if (!existing) return null

  await prisma.product.delete({ where: { id: existing.id } })
  return { id: existing.id }
}