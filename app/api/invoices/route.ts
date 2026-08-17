import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { invoiceInternalCreateSchema } from "@/lib/validation/internal/invoice"
import { getWorkspace, getWorkspaceAccess } from "@/lib/workspace"
import { withService } from "@/lib/api-error"
import { createInvoice, listInvoices } from "@/lib/services/invoice.service"
import {
  toInternalInvoice,
  toInternalInvoiceList,
} from "@/lib/dto/internal/invoice.dto"

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

  const result = await listInvoices(workspace.businessId, {
    page,
    pageSize,
    branchId: workspace.branchId,
  })
  return NextResponse.json(toInternalInvoiceList(result))
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

  const parsed = invoiceInternalCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 }
    )
  }

  const result = await withService(() =>
    createInvoice(
      workspace.businessId,
      workspace.branchId,
      user.id,
      parsed.data
    )
  )
  if ("error" in result) return result.error
  return NextResponse.json(
    { invoice: toInternalInvoice(result.data) },
    { status: 201 }
  )
}