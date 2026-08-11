import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { getWorkspace } from "@/lib/workspace"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function profileFromBusiness(business: {
  name: string
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
    businessName: business.name,
    street: business.street,
    city: business.city,
    country: business.country,
    legalName: business.legalName ?? "",
    vatNumber: business.vatNumber ?? "",
    email: business.email ?? "",
    phone: business.phone ?? "",
    region: business.region ?? "",
    subCity: business.subCity ?? "",
    wereda: business.wereda ?? "",
    houseNumber: business.houseNumber ?? "",
    locality: business.locality ?? "",
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

  const business = await prisma.business.findUnique({
    where: { id: workspace.businessId },
  })
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  }
  const credential = await prisma.morCredential.findUnique({
    where: { businessId: workspace.businessId },
    select: { tin: true, systemNumber: true, systemType: true },
  })
  return NextResponse.json({
    profile: profileFromBusiness(business),
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

  if (!str(body.businessName)) {
    return NextResponse.json(
      { error: "Business name is required" },
      { status: 400 }
    )
  }

  const business = await prisma.business.update({
    where: { id: workspace.businessId },
    data: { name: str(body.businessName), ...data },
  })

  return NextResponse.json({ profile: profileFromBusiness(business) })
}
