import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { bulkCancelSchema } from "@/lib/einvoice/operation-schema"
import { bulkCancel } from "@/lib/einvoice/bulk-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function POST(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = bulkCancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const { invoiceIds: rawIds, ...input } = parsed.data
  const invoiceIds = [...new Set(rawIds)]
  const result = await bulkCancel(auth.userId, businessId, invoiceIds, input)
  return NextResponse.json(result.body, { status: result.status })
}
