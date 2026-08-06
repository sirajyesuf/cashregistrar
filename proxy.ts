import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

const AUTH_ROUTES = ["/login"]
const PROTECTED_ROUTES = ["/dashboard", "/invoices", "/settings"]
const ADMIN_LOGIN = "/admin/login"
const SIGN_UP_API = "/api/auth/sign-up/email"

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Registration is admin-only: users are created from the admin area, so the
  // public sign-up endpoint is disabled. (The admin flow creates users via the
  // internal auth API, which does not pass through the proxy.)
  if (pathname === SIGN_UP_API) {
    return NextResponse.json(
      { error: "Registration is disabled. Users are created by an admin." },
      { status: 403 }
    )
  }

  let authenticated = false
  let role: string | undefined
  if (!pathname.startsWith("/api/")) {
    try {
      const session = await auth.api.getSession({ headers: request.headers })
      authenticated = Boolean(session?.user)
      role = session?.user?.role
    } catch {
      authenticated = false
    }
  }

  if (authenticated && (pathname === "/" || matches(pathname, AUTH_ROUTES))) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Admin login page is public. An admin who is already signed in jumps to /admin.
  if (pathname === ADMIN_LOGIN) {
    if (authenticated && role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url))
    }
    return NextResponse.next()
  }

  if (!authenticated && matches(pathname, PROTECTED_ROUTES)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Everything else under /admin requires the admin role.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!authenticated) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN, request.url))
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
