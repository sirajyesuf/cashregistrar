import type { Invoice, InvoiceLine, Receipt, WithholdingReceipt } from "@prisma/client"
import { prisma } from "@/lib/db"
import { canAccessBranch, getBusinessAccess, type BusinessAccess } from "@/lib/business"

/**
 * Response envelope returned by EIMS service functions. EIMS responses are
 * heterogeneous (429 retryAfter, 502 auth detail, 201/202 success, structured
 * EIMS error bodies), so services return a status plus a body and let the
 * caller wrap it with NextResponse.json(body, { status }).
 */
export type EimsServiceResult = { status: number; body: unknown }

export type InvoiceWithRelations = Invoice & {
  lines: InvoiceLine[]
  receipt: Receipt | null
  withholdingReceipt: WithholdingReceipt | null
}

export type InvoiceAccessResult =
  | { ok: true; access: BusinessAccess; invoice: InvoiceWithRelations }
  | { ok: false; status: number; body: unknown }

/**
 * Authorizes a user against a business (via BusinessMember) and a specific
 * invoice within it (via branch access). An optional scopeBranchId further
 * restricts the invoice to the caller's active workspace branch, which is how
 * the session-based internal routes preserve their branch scope.
 */
export async function requireInvoiceAccess(
  userId: string,
  businessId: string,
  invoiceId: string,
  scopeBranchId?: string
): Promise<InvoiceAccessResult> {
  const access = await getBusinessAccess(userId, businessId)
  if (!access)
    return { ok: false, status: 404, body: { error: "Invoice not found" } }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: { lines: { orderBy: { lineNumber: "asc" } }, receipt: true, withholdingReceipt: true },
  })
  if (!invoice)
    return { ok: false, status: 404, body: { error: "Invoice not found" } }
  if (!canAccessBranch(access, invoice.branchId))
    return { ok: false, status: 404, body: { error: "Invoice not found" } }
  if (scopeBranchId && invoice.branchId !== scopeBranchId)
    return { ok: false, status: 404, body: { error: "Invoice not found" } }

  return { ok: true, access, invoice }
}
