import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth/password"
import {
  SESSION_COOKIE,
  MAX_AGE_SECONDS,
  createSessionToken,
  isSecureRequest,
} from "@/lib/auth/session"

export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  const name = body.name?.trim() || null

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    )
  }

  const user = await prisma.user.create({
    data: { email, name, passwordHash: hashPassword(password) },
  })

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
  })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })

  return NextResponse.json(
    { id: user.id, email: user.email, name: user.name },
    { status: 201 }
  )
}
