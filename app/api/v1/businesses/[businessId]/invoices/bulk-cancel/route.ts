import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { requireOwnerAccess } from "@/lib/api-owner"
import { publicError } from "@/lib/api-error"
import { bulkCancelSchema } from "@/lib/einvoice/operation-schema"
import { bulkCancel } from "@/lib/einvoice/bulk-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function POST(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId } = await params
  const owner = await requireOwnerAccess(auth.userId, businessId)
  if (!owner.ok) return owner.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return publicError(400, "BAD_REQUEST", "Invalid JSON body")
  }

  const parsed = bulkCancelSchema.safeParse(body)
  if (!parsed.success) {
    return publicError(
      422,
      "VALIDATION_ERROR",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    )
  }

  const { invoiceIds: rawIds, ...input } = parsed.data
  const invoiceIds = [...new Set(rawIds)]
  const result = await bulkCancel(auth.userId, businessId, invoiceIds, input)
  return NextResponse.json(result.body, { status: result.status })
}