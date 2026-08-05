import { NextResponse } from "next/server"
import { forceLogin, maskToken } from "@/lib/einvoice/token"

export const runtime = "nodejs"

export async function POST() {
  try {
    const token = await forceLogin()
    return NextResponse.json({
      ok: true,
      accessToken: maskToken(token.accessToken),
      refreshToken: token.refreshToken ? maskToken(token.refreshToken) : null,
      expiresAt: token.expiresAt,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "EIMS login failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
