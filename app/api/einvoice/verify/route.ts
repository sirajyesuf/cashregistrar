import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { getWorkspace } from "@/lib/workspace"
import {
  verifyByIrn,
  verifyLocalInvoice,
} from "@/lib/einvoice/verify-service"
import {
  verifyInvoiceIdSchema,
  verifyIrnSchema,
} from "@/lib/einvoice/operation-schema"

export const runtime = "nodejs"

/**
 * Session-authenticated EIMS invoice verification. Accepts either:
 *
 *   { "irn": "…" }              verify any IRN against EIMS
 *   { "invoiceId": "…" }        verify a local invoice by its stored IRN
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const byIrn = verifyIrnSchema.safeParse(body)
  const byInvoice = verifyInvoiceIdSchema.safeParse(body)
  if (byIrn.success && byInvoice.success) {
    return NextResponse.json(
      { error: "Provide either irn or invoiceId, not both" },
      { status: 400 }
    )
  }
  if (!byIrn.success && !byInvoice.success) {
    const raw =
      body && typeof body === "object"
        ? (body as { irn?: unknown; invoiceId?: unknown })
        : {}
    const hasIrn = typeof raw.irn === "string" && raw.irn.trim() !== ""
    const hasInvoiceId =
      typeof raw.invoiceId === "string" && raw.invoiceId.trim() !== ""
    if (hasIrn && !hasInvoiceId) {
      return NextResponse.json(
        { error: byIrn.error.issues.map((issue) => issue.message).join("; ") },
        { status: 400 }
      )
    }
    if (hasInvoiceId && !hasIrn) {
      return NextResponse.json(
        {
          error: byInvoice.error.issues
            .map((issue) => issue.message)
            .join("; "),
        },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Provide either irn or invoiceId" },
      { status: 400 }
    )
  }
  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "No active workspace" }, { status: 409 })
  }

  const result = byIrn.success
    ? await verifyByIrn(user.id, workspace.businessId, byIrn.data.irn)
    : byInvoice.success
      ? await verifyLocalInvoice(
          user.id,
          workspace.businessId,
          byInvoice.data.invoiceId,
          workspace.branchId
        )
      : null

  if (!result) {
    return NextResponse.json(
      { error: "Provide either irn or invoiceId" },
      { status: 400 }
    )
  }
  return NextResponse.json(result.body, { status: result.status })
}