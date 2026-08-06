import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/auth/admin"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { invoices: true } },
    },
  })

  return NextResponse.json({ users })
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  let body: {
    name?: unknown
    email?: unknown
    password?: unknown
    role?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password : ""
  const role = body.role === "admin" ? "admin" : "user"

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 }
    )
  }
  if (password.length < 5) {
    return NextResponse.json(
      { error: "Password must be at least 5 characters" },
      { status: 400 }
    )
  }

  try {
    // Create the user via better-auth so the password is hashed the same way
    // as normal sign-ups. No headers are passed, so no session cookie is set
    // on the admin's response.
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
    })
    if (!result?.user?.id) {
      return NextResponse.json(
        { error: "Could not create user" },
        { status: 400 }
      )
    }
    const user = await prisma.user.update({
      where: { id: result.user.id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { invoices: true } },
      },
    })
    return NextResponse.json({ user }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create user"
    const isDuplicate = /exists|already/i.test(message)
    return NextResponse.json(
      { error: isDuplicate ? "Email already exists" : message },
      { status: isDuplicate ? 409 : 400 }
    )
  }
}
