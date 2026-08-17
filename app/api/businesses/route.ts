import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { businessInternalCreateSchema } from "@/lib/validation/internal/business"
import { withService } from "@/lib/api-error"
import {
  createBusiness,
  listUserBusinesses,
} from "@/lib/services/business.service"
import {
  toInternalBusinessList,
  toInternalCreatedBusiness,
} from "@/lib/dto/internal/business.dto"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const businesses = await listUserBusinesses(user.id)
  return NextResponse.json({
    businesses: businesses.map(toInternalBusinessList),
  })
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

  const parsed = businessInternalCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await withService(() => createBusiness(user.id, parsed.data))
  if ("error" in result) return result.error
  return NextResponse.json(
    { business: toInternalCreatedBusiness(result.data) },
    { status: 201 }
  )
}