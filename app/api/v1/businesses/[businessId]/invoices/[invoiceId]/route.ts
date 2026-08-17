import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { invoicePublicUpdateSchema } from "@/lib/validation/public/invoice"
import { canManageBusiness, getBusinessAccess } from "@/lib/business"
import { publicError, publicErrorResponse, withService } from "@/lib/api-error"
import {
  deleteInvoice,
  getInvoice,
  updateInvoice,
} from "@/lib/services/invoice.service"
import { toPublicInvoice } from "@/lib/dto/public/invoice.dto"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; invoiceId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, invoiceId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access) return publicError(404, "NOT_FOUND", "Invoice not found")
  if (!canManageBusiness(access.role)) {
    return publicError(403, "FORBIDDEN", "Business owner access required")
  }

  const invoice = await getInvoice(businessId, invoiceId)
  if (!invoice) return publicError(404, "NOT_FOUND", "Invoice not found")
  return NextResponse.json({ invoice: toPublicInvoice(invoice) })
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, invoiceId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access) return publicError(404, "NOT_FOUND", "Invoice not found")
  if (!canManageBusiness(access.role)) {
    return publicError(403, "FORBIDDEN", "Business owner access required")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return publicError(400, "BAD_REQUEST", "Invalid JSON body")
  }

  const parsed = invoicePublicUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return publicError(
      422,
      "VALIDATION_ERROR",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    )
  }

  const result = await withService(
    () => updateInvoice(businessId, invoiceId, parsed.data),
    publicErrorResponse
  )
  if ("error" in result) return result.error
  if (!result.data) return publicError(404, "NOT_FOUND", "Invoice not found")
  return NextResponse.json({ invoice: toPublicInvoice(result.data) })
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, invoiceId } = await params
  const access = await getBusinessAccess(auth.userId, businessId)
  if (!access) return publicError(404, "NOT_FOUND", "Invoice not found")
  if (!canManageBusiness(access.role)) {
    return publicError(403, "FORBIDDEN", "Business owner access required")
  }

  const result = await withService(
    () => deleteInvoice(businessId, invoiceId),
    publicErrorResponse
  )
  if ("error" in result) return result.error
  if (!result.data) return publicError(404, "NOT_FOUND", "Invoice not found")
  return NextResponse.json({ ok: true })
}