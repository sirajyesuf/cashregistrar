import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { invoicePublicCreateSchema } from "@/lib/validation/public/invoice"
import { canManageBusiness, getBusinessAccess } from "@/lib/business"
import { publicError, publicErrorResponse, withService } from "@/lib/api-error"
import { createInvoice, listInvoices } from "@/lib/services/invoice.service"
import {
  toPublicInvoice,
  toPublicInvoiceList,
} from "@/lib/dto/public/invoice.dto"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access) return publicError(404, "NOT_FOUND", "Business not found")
  if (!canManageBusiness(access.role)) {
    return publicError(403, "FORBIDDEN", "Business owner access required")
  }

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("pageSize")) || 10)
  )
  const branchId = url.searchParams.get("branchId")?.trim() || undefined

  const result = await listInvoices(businessId, { page, pageSize, branchId })
  return NextResponse.json(toPublicInvoiceList(result))
}

export async function POST(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access) return publicError(404, "NOT_FOUND", "Business not found")
  if (!canManageBusiness(access.role)) {
    return publicError(403, "FORBIDDEN", "Business owner access required")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return publicError(400, "BAD_REQUEST", "Invalid JSON body")
  }

  const parsed = invoicePublicCreateSchema.safeParse(body)
  if (!parsed.success) {
    return publicError(
      422,
      "VALIDATION_ERROR",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    )
  }

  const { branchId, ...input } = parsed.data
  const idempotencyKey =
    request.headers.get("idempotency-key")?.trim() || undefined
  const result = await withService(
    () => createInvoice(businessId, branchId, auth.userId, input, {
      idempotencyKey,
    }),
    publicErrorResponse
  )
  if ("error" in result) return result.error
  return NextResponse.json(
    { invoice: toPublicInvoice(result.data) },
    { status: 201 }
  )
}