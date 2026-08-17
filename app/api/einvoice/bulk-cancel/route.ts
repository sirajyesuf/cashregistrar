import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { getWorkspace } from "@/lib/workspace"
import { bulkCancel } from "@/lib/einvoice/bulk-service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { invoiceIds?: unknown; reason?: unknown; remark?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const invoiceIds = Array.isArray(body.invoiceIds)
    ? [
        ...new Set(
          body.invoiceIds
            .filter(
              (id): id is string =>
                typeof id === "string" && id.trim().length > 0
            )
            .map((id) => id.trim())
        ),
      ]
    : []
  if (invoiceIds.length === 0)
    return NextResponse.json({ error: "No invoices selected" }, { status: 400 })
  if (invoiceIds.length > 50)
    return NextResponse.json(
      { error: "A maximum of 50 invoices can be submitted at once" },
      { status: 400 }
    )

  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace. Select a business and branch." },
      { status: 409 }
    )
  }

  const result = await bulkCancel(
    user.id,
    workspace.businessId,
    invoiceIds,
    { reason: body.reason, remark: body.remark },
    workspace.branchId
  )
  return NextResponse.json(result.body, { status: result.status })
}
