import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { getWorkspace } from "@/lib/workspace"
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
  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "No active workspace" }, { status: 409 })
  }

  const profile = await prisma.sellerProfile.findUnique({
    where: { businessId: workspace.businessId },
  })
  const credential = await prisma.morCredential.findUnique({
    where: { businessId: workspace.businessId },
    select: { tin: true, systemNumber: true, systemType: true },
  })
  return NextResponse.json({
    profile: profile ? profileToResponse(profile) : null,
    source: {
      tin: credential?.tin ?? "",
      systemNumber: credential?.systemNumber ?? "",
      systemType: credential?.systemType ?? "",
    },
  })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "No active workspace" }, { status: 409 })
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

  const profile = await prisma.sellerProfile.upsert({
    where: { businessId: workspace.businessId },
    create: { businessId: workspace.businessId, ...data },
    update: data,
  })

  return NextResponse.json({ profile: profileToResponse(profile) })
}
