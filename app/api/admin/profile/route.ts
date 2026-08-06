import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/auth/admin"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }
  return NextResponse.json({
    profile: {
      name: guard.user!.name,
      email: guard.user!.email,
      role: guard.user!.role,
    },
  })
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  let body: { name?: unknown; currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : ""
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : ""

  if (name) {
    await prisma.user.update({
      where: { id: guard.user!.id },
      data: { name },
    })
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to change the password" },
        { status: 400 }
      )
    }
    if (newPassword.length < 5) {
      return NextResponse.json(
        { error: "New password must be at least 5 characters" },
        { status: 400 }
      )
    }
    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword },
        headers: await headers(),
      })
    } catch {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      )
    }
  }

  return NextResponse.json({ ok: true })
}
