import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { cancelInputSchema } from "@/lib/einvoice/operation-schema"
import { cancelInvoice } from "@/lib/einvoice/cancel-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; invoiceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, invoiceId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = cancelInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await cancelInvoice(
    auth.userId,
    businessId,
    invoiceId,
    parsed.data
  )
  return NextResponse.json(result.body, { status: result.status })
}
