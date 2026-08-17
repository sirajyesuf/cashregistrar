import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/user"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

type Context = { params: Promise<{ keyId: string }> }

export async function DELETE(_request: Request, context: Context) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { keyId } = await context.params

  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, userId: user.id },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 })
  }

  await prisma.apiKey.delete({ where: { id: keyId } })

  return NextResponse.json({ ok: true })
}
