import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { getWorkspace } from "@/lib/workspace"
import { eimsRouteHandler } from "@/lib/einvoice/client"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json({ error: "No active workspace" }, { status: 409 })
  }
  return eimsRouteHandler("/v1/receipt/withholding", request, workspace.businessId)
}
