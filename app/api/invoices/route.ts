import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { invoiceInputSchema } from "@/lib/invoice-schema"
import { getWorkspace, getWorkspaceAccess } from "@/lib/workspace"
import { createInvoice, listInvoices } from "@/lib/invoice-service"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const businessId = url.searchParams.get("businessId")
  const branchId = url.searchParams.get("branchId")

  const workspace =
    businessId && branchId
      ? await getWorkspaceAccess(user.id, businessId, branchId)
      : await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch." },
      { status: 409 }
    )
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("pageSize")) || 10)
  )

  const result = await listInvoices(user.id, workspace.businessId, {
    page,
    pageSize,
    branchId: workspace.branchId,
  })
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data)
}

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

  const result = await createInvoice(
    user.id,
    workspace.businessId,
    workspace.branchId,
    parsed.data
  )
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ invoice: result.data }, { status: 201 })
}
