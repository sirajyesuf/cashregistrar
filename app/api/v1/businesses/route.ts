import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { createBusinessApiSchema } from "@/lib/business-schema"
import { createBusiness, listUserBusinesses } from "@/lib/business-service"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const result = await listUserBusinesses(auth.userId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ businesses: result.data })
}

export async function POST(request: Request) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

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

  const result = await createBusiness(auth.userId, parsed.data)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ business: result.data }, { status: 201 })
}
