import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

const AUTH_ROUTES = ["/login", "/register"]
const PROTECTED_ROUTES = ["/dashboard", "/invoices"]
const ADMIN_LOGIN = "/admin/login"

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  if (authenticated && matches(pathname, AUTH_ROUTES)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Admin login page is public. An admin who is already signed in jumps to /admin.
  if (pathname === ADMIN_LOGIN) {
    if (authenticated && role === "ADMIN") {
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
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
