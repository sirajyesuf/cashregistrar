import { NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-key"
import { requireOwnerAccess } from "@/lib/api-owner"
import { registerInvoice } from "@/lib/einvoice/register-service"

export const runtime = "nodejs"

type Context = { params: Promise<{ businessId: string; invoiceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const auth = await requireApiKey(request)
  if (!auth.ok) return auth.response

  const { businessId, invoiceId } = await params
  const owner = await requireOwnerAccess(auth.userId, businessId)
  if (!owner.ok) return owner.response

  const result = await registerInvoice(auth.userId, businessId, invoiceId)
  return NextResponse.json(result.body, { status: result.status })
}