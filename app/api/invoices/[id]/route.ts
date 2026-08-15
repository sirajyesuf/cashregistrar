import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { invoiceInputSchema } from "@/lib/invoice-schema"
import { getWorkspace } from "@/lib/workspace"
import {
  deleteInvoice,
  getInvoice,
  updateInvoice,
} from "@/lib/invoice-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(
  _request: Request,
  context: Context
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const { id } = await context.params
  const result = await getInvoice(user.id, workspace.businessId, id, workspace.branchId)
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ invoice: result.data })
}

export async function PUT(
  request: Request,
  context: Context
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const { id } = await context.params

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
    user.id,
    workspace.businessId,
    id,
    parsed.data,
    workspace.branchId
  )
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ invoice: result.data })
}

export async function DELETE(
  _request: Request,
  context: Context
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const { id } = await context.params
  const result = await deleteInvoice(
    user.id,
    workspace.businessId,
    id,
    workspace.branchId
  )
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
