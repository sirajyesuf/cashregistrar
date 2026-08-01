import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session"

const AUTH_ROUTES = ["/login", "/register"]
const PROTECTED_ROUTES = ["/dashboard", "/invoices", "/settings"]

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const sessionUser = token ? await verifySessionToken(token) : null
  const { pathname } = request.nextUrl

  if (sessionUser && (pathname === "/" || matches(pathname, AUTH_ROUTES))) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }
  if (!sessionUser && matches(pathname, PROTECTED_ROUTES)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
