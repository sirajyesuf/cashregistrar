import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { getWorkspace } from "@/lib/workspace"
import { bulkDeleteInvoices } from "@/lib/services/invoice.service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch." },
      { status: 409 }
    )
  }

  let body: { ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string")
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: "No invoices selected" }, { status: 400 })
  }

  const result = await bulkDeleteInvoices(
    workspace.businessId,
    workspace.branchId,
    ids,
    workspace.role === "CASHIER" ? user.id : undefined
  )
  return NextResponse.json(result)
}