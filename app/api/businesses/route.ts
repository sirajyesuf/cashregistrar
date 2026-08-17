import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { createBusinessApiSchema } from "@/lib/business-schema"
import { createBusiness, listUserBusinesses } from "@/lib/business-service"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const result = await listUserBusinesses(user.id)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ businesses: result.data })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createBusinessApiSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await createBusiness(user.id, parsed.data)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ business: result.data }, { status: 201 })
}
