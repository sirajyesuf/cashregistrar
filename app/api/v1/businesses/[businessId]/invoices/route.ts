import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { invoiceCreateApiSchema } from "@/lib/invoice-schema"
import { createInvoice, listInvoices } from "@/lib/invoice-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string }> }

export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId } = await params
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("pageSize")) || 10)
  )
  const branchId = url.searchParams.get("branchId")?.trim() || undefined

  const result = await listInvoices(auth.userId, businessId, {
    page,
    pageSize,
    branchId,
  })
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data)
}

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

  const parsed = invoiceCreateApiSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const { branchId, ...input } = parsed.data
  const idempotencyKey =
    request.headers.get("idempotency-key")?.trim() || undefined
  const result = await createInvoice(auth.userId, businessId, branchId, input, {
    idempotencyKey,
  })
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ invoice: result.data }, { status: 201 })
}
