import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { invoiceInternalUpdateSchema } from "@/lib/validation/internal/invoice"
import { getWorkspace } from "@/lib/workspace"
import { withService } from "@/lib/api-error"
import {
  deleteInvoice,
  getInvoice,
  updateInvoice,
} from "@/lib/services/invoice.service"
import { toInternalInvoice } from "@/lib/dto/internal/invoice.dto"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

// Cashiers can only view/edit/delete their own invoices; owners and managers
// keep full access to the branch.
function ownScope(workspace: { role: string }, userId: string) {
  return workspace.role === "CASHIER" ? userId : undefined
}

export async function GET(_request: Request, context: Context) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const { id } = await context.params
  const invoice = await getInvoice(
    workspace.businessId,
    id,
    workspace.branchId,
    ownScope(workspace, user.id)
  )
  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  return NextResponse.json({ invoice: toInternalInvoice(invoice) })
}

export async function PUT(request: Request, context: Context) {
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

  const parsed = invoiceInternalUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await withService(() =>
    updateInvoice(
      workspace.businessId,
      id,
      parsed.data,
      workspace.branchId,
      ownScope(workspace, user.id)
    )
  )
  if ("error" in result) return result.error
  if (!result.data)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  return NextResponse.json({ invoice: toInternalInvoice(result.data) })
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const { id } = await context.params
  const result = await withService(() =>
    deleteInvoice(
      workspace.businessId,
      id,
      workspace.branchId,
      ownScope(workspace, user.id)
    )
  )
  if ("error" in result) return result.error
  if (!result.data)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}