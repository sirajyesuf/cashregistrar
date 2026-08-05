import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { forceRefresh, maskToken } from "@/lib/einvoice/token"

export const runtime = "nodejs"

const TOKEN_ID = "singleton"

export async function GET() {
  const stored = await prisma.eimsToken.findUnique({ where: { id: TOKEN_ID } })
  if (!stored) {
    return NextResponse.json({ ok: false, token: null }, { status: 200 })
  }
  return NextResponse.json({
    ok: true,
    accessToken: maskToken(stored.accessToken),
    refreshToken: stored.refreshToken ? maskToken(stored.refreshToken) : null,
    expiresAt: stored.expiresAt,
  })
}

export async function POST() {
  try {
    const token = await forceRefresh()
    return NextResponse.json({
      ok: true,
      accessToken: maskToken(token.accessToken),
      refreshToken: token.refreshToken ? maskToken(token.refreshToken) : null,
      expiresAt: token.expiresAt,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "EIMS token refresh failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
