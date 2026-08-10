import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { getWorkspace } from "@/lib/workspace"
import { forceLogin, maskToken } from "@/lib/einvoice/token"

export const runtime = "nodejs"

export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  const workspace = await getWorkspace(user.id)
  if (!workspace) {
    return NextResponse.json(
      { error: "No active workspace" },
      { status: 409 }
    )
  }
  try {
    const token = await forceLogin(workspace.businessId)
    return NextResponse.json({
      ok: true,
      accessToken: maskToken(token.accessToken),
      refreshToken: token.refreshToken ? maskToken(token.refreshToken) : null,
      expiresAt: token.expiresAt,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "EIMS login failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
