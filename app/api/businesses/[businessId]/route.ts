import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/auth/user"
import { getBusinessAccess, canManageBusiness } from "@/lib/business"
import { morCredentialUpdateSchema } from "@/lib/business-schema"
import { REGION_CODES } from "@/lib/regions"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

const POSITIVE_INT_REGEX = /^[1-9]\d*$/

const positiveInteger = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === "" || POSITIVE_INT_REGEX.test(value),
      `${label} must be an integer greater than 0`
    )

const updateBusinessSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(240).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  active: z.boolean().optional(),
  city: positiveInteger("City").max(120).optional(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(160)
    .nullable()
    .optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  region: z
    .enum([...REGION_CODES, ""])
    .nullable()
    .optional(),
  wereda: positiveInteger("Wereda").max(120).nullable().optional(),
  country: z.string().trim().max(120).optional(),
  houseNumber: z.string().trim().max(120).nullable().optional(),
})

export async function GET(_request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access)
    return NextResponse.json({ error: "Business not found" }, { status: 404 })

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

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  }

  const { morCredential, ...rest } = business
  const revealSecrets = access.role === "OWNER"
  return NextResponse.json({
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
  })
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { businessId } = await params
  const access = await getBusinessAccess(user.id, businessId)
  if (!access || !canManageBusiness(access.role)) {
    return NextResponse.json(
      { error: "Business owner access required" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = updateBusinessSchema
    .extend({ morCredential: morCredentialUpdateSchema.optional() })
    .safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const { morCredential, ...businessData } = parsed.data
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
  return NextResponse.json({ business })
}
