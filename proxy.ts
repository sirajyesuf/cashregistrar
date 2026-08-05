import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

const AUTH_ROUTES = ["/login", "/register"]
const PROTECTED_ROUTES = ["/dashboard", "/invoices", "/settings"]

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let authenticated = false
  if (!pathname.startsWith("/api/")) {
    try {
      const session = await auth.api.getSession({ headers: request.headers })
      authenticated = Boolean(session?.user)
    } catch {
      authenticated = false
    }
  }

  if (authenticated && (pathname === "/" || matches(pathname, AUTH_ROUTES))) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }
  if (!authenticated && matches(pathname, PROTECTED_ROUTES)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
