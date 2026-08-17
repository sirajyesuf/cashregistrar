import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { businessPublicCreateSchema } from "@/lib/validation/public/business"
import { publicError, publicErrorResponse, withService } from "@/lib/api-error"
import {
  createBusiness,
  listUserBusinesses,
} from "@/lib/services/business.service"
import {
  toPublicBusiness,
  toPublicCreatedBusiness,
} from "@/lib/dto/public/business.dto"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const businesses = await listUserBusinesses(auth.userId, { ownerOnly: true })
  return NextResponse.json({
    businesses: businesses.map(toPublicBusiness),
  })
}

export async function POST(request: Request) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return publicError(400, "BAD_REQUEST", "Invalid JSON body")
  }

  const parsed = businessPublicCreateSchema.safeParse(body)
  if (!parsed.success) {
    return publicError(
      422,
      "VALIDATION_ERROR",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    )
  }

  const result = await withService(
    () => createBusiness(auth.userId, parsed.data),
    publicErrorResponse
  )
  if ("error" in result) return result.error
  return NextResponse.json(
    { business: toPublicCreatedBusiness(result.data) },
    { status: 201 }
  )
}