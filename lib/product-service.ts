import { Prisma } from "@prisma/client"
import type { Product } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getBusinessAccess, isPrismaUniqueError } from "@/lib/business"
import { conflict, notFound, type ServiceResult } from "@/lib/service"
import type { ProductInput } from "@/lib/product-schema"

function normalizePrice(sellingPrice: number): Prisma.Decimal {
  return new Prisma.Decimal(Math.round(sellingPrice * 100)).div(100)
}

async function isMember(userId: string, businessId: string): Promise<boolean> {
  return (await getBusinessAccess(userId, businessId)) !== null
}

export async function listProducts(
  userId: string,
  businessId: string,
  query?: string
): Promise<ServiceResult<Product[]>> {
  if (!(await isMember(userId, businessId))) return notFound("Business not found")

  const products = await prisma.product.findMany({
    where: {
      businessId,
      ...(query ? { name: { contains: query } } : {}),
    },
    orderBy: { name: "asc" },
  })

  return { ok: true, data: products }
}

export async function createProduct(
  userId: string,
  businessId: string,
  input: ProductInput
): Promise<ServiceResult<Product>> {
  if (!(await isMember(userId, businessId))) return notFound("Business not found")

  const { name, itemCode, unit, sellingPrice } = input
  try {
    const product = await prisma.product.create({
      data: {
        businessId,
        name,
        itemCode: itemCode || null,
        unit: unit || "PCS",
        sellingPrice: normalizePrice(sellingPrice),
      },
    })
    return { ok: true, data: product }
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return conflict(`A product named "${name}" already exists`)
    }
    throw error
  }
}

export async function getProduct(
  userId: string,
  businessId: string,
  productId: string
): Promise<ServiceResult<Product>> {
  if (!(await isMember(userId, businessId))) return notFound("Product not found")

  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
  })
  if (!product) return notFound("Product not found")

  return { ok: true, data: product }
}

export async function updateProduct(
  userId: string,
  businessId: string,
  productId: string,
  input: ProductInput
): Promise<ServiceResult<Product>> {
  if (!(await isMember(userId, businessId))) return notFound("Product not found")

  const existing = await prisma.product.findFirst({
    where: { id: productId, businessId },
  })
  if (!existing) return notFound("Product not found")

  const { name, itemCode, unit, sellingPrice } = input
  try {
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        name,
        itemCode: itemCode || null,
        unit: unit || "PCS",
        sellingPrice: normalizePrice(sellingPrice),
      },
    })
    return { ok: true, data: product }
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return conflict(`A product named "${name}" already exists`)
    }
    throw error
  }
}

export async function deleteProduct(
  userId: string,
  businessId: string,
  productId: string
): Promise<ServiceResult<{ id: string }>> {
  if (!(await isMember(userId, businessId))) return notFound("Product not found")

  const existing = await prisma.product.findFirst({
    where: { id: productId, businessId },
  })
  if (!existing) return notFound("Product not found")

  await prisma.product.delete({ where: { id: existing.id } })
  return { ok: true, data: { id: existing.id } }
}
