import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const profile = await prisma.sellerProfile.findFirst()
  return NextResponse.json({
    profile: {
      businessName: profile?.businessName ?? "",
      street: profile?.street ?? "",
      city: profile?.city ?? "",
      country: profile?.country ?? "",
    },
  })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: {
    businessName?: unknown
    street?: unknown
    city?: unknown
    country?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const data = {
    businessName:
      typeof body.businessName === "string" ? body.businessName.trim() : "",
    street: typeof body.street === "string" ? body.street.trim() : "",
    city: typeof body.city === "string" ? body.city.trim() : "",
    country: typeof body.country === "string" ? body.country.trim() : "",
  }

  if (!data.businessName) {
    return NextResponse.json(
      { error: "Business name is required" },
      { status: 400 }
    )
  }

  const existing = await prisma.sellerProfile.findFirst()
  const profile = existing
    ? await prisma.sellerProfile.update({ where: { id: existing.id }, data })
    : await prisma.sellerProfile.create({ data })

  return NextResponse.json({
    profile: {
      businessName: profile.businessName,
      street: profile.street,
      city: profile.city,
      country: profile.country,
    },
  })
}
