import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { getWorkspace } from "@/lib/workspace"
import { cancelInvoice } from "@/lib/einvoice/cancel-service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { invoiceId?: unknown; reason?: unknown; remark?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const invoiceId =
    typeof body.invoiceId === "string" ? body.invoiceId.trim() : ""
  if (!invoiceId) {
    return NextResponse.json(
      { error: "invoiceId is required" },
      { status: 400 }
    )
  }

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const result = await cancelInvoice(
    user.id,
    workspace.businessId,
    invoiceId,
    { reason: body.reason, remark: body.remark },
    workspace.branchId
  )
  return NextResponse.json(result.body, { status: result.status })
}
