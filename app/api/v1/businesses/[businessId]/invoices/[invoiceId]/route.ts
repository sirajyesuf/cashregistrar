import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { invoiceInputSchema } from "@/lib/invoice-schema"
import {
  deleteInvoice,
  getInvoice,
  updateInvoice,
} from "@/lib/invoice-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; invoiceId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, invoiceId } = await params
  const result = await getInvoice(auth.userId, businessId, invoiceId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ invoice: result.data })
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, invoiceId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = invoiceInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await updateInvoice(
    auth.userId,
    businessId,
    invoiceId,
    parsed.data
  )
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ invoice: result.data })
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, invoiceId } = await params
  const result = await deleteInvoice(auth.userId, businessId, invoiceId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
