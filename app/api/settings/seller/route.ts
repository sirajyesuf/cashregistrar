import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function profileToResponse(profile: {
  businessName: string
  street: string
  city: string
  country: string
  legalName: string | null
  vatNumber: string | null
  email: string | null
  phone: string | null
  region: string | null
  subCity: string | null
  wereda: string | null
  houseNumber: string | null
  locality: string | null
}) {
  return {
    businessName: profile.businessName,
    street: profile.street,
    city: profile.city,
    country: profile.country,
    legalName: profile.legalName ?? "",
    vatNumber: profile.vatNumber ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    region: profile.region ?? "",
    subCity: profile.subCity ?? "",
    wereda: profile.wereda ?? "",
    houseNumber: profile.houseNumber ?? "",
    locality: profile.locality ?? "",
  }
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const profile = await prisma.sellerProfile.findFirst()
  return NextResponse.json({
    profile: profile ? profileToResponse(profile) : null,
    source: {
      tin: process.env.EINVOICE_TIN ?? "",
      systemNumber: process.env.EINVOICE_SYSTEM_NUMBER ?? "",
      systemType: process.env.EINVOICE_SYSTEM_TYPE ?? "",
    },
  })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const data = {
    businessName: str(body.businessName),
    street: str(body.street),
    city: str(body.city),
    country: str(body.country),
    legalName: str(body.legalName),
    vatNumber: str(body.vatNumber),
    email: str(body.email),
    phone: str(body.phone),
    region: str(body.region),
    subCity: str(body.subCity),
    wereda: str(body.wereda),
    houseNumber: str(body.houseNumber),
    locality: str(body.locality),
  }

  if (!data.businessName) {
    return NextResponse.json(
      { error: "Business name is required" },
      { status: 400 }
    )
  }

  const existing = await prisma.sellerProfile.findFirst()
  const profile = existing
    ? await prisma.sellerProfile.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.sellerProfile.create({ data })

  return NextResponse.json({ profile: profileToResponse(profile) })
}
