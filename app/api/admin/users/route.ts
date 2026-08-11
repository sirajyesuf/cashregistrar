import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/auth/admin"
import { isPrismaUniqueError } from "@/lib/business"
import { prisma } from "@/lib/db"
import { adminUserSchema } from "@/lib/admin-user-schema"

export const runtime = "nodejs"

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { invoices: true } },
    },
  })

  return NextResponse.json({ users })
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = adminUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const { name, password, role, business, morCredential, branch } = parsed.data
  const email = parsed.data.email.toLowerCase()

  try {
    // Create the user via better-auth so the password is hashed the same way
    // as normal sign-ups. No headers are passed, so no session cookie is set
    // on the admin's response.
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
    })
    if (!result?.user?.id) {
      return NextResponse.json(
        { error: "Could not create user" },
        { status: 400 }
      )
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: result.user.id },
        data: { role },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { invoices: true } },
        },
      })

      const createdBusiness = await tx.business.create({
        data: {
          name: business.name,
          address: business.address || null,
          ownerId: result.user.id,
          email: email,
        },
      })
      await tx.morCredential.create({
        data: {
          businessId: createdBusiness.id,
          ...morCredential,
        },
      })
      const createdBranch = await tx.branch.create({
        data: {
          businessId: createdBusiness.id,
          name: branch.name,
          address: branch.address || null,
        },
      })
      await tx.businessMember.create({
        data: {
          userId: result.user.id,
          businessId: createdBusiness.id,
          role: "OWNER",
        },
      })
      await tx.userPreference.create({
        data: {
          userId: result.user.id,
          businessId: createdBusiness.id,
          branchId: createdBranch.id,
        },
      })

      return updated
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create user"
    const isDuplicate = /exists|already/i.test(message)
    return NextResponse.json(
      {
        error: isPrismaUniqueError(err)
          ? "A business with this information already exists"
          : isDuplicate
            ? "Email already exists"
            : message,
      },
      { status: isDuplicate || isPrismaUniqueError(err) ? 409 : 400 }
    )
  }
}
