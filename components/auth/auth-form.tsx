"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { authClient } from "@/lib/auth-client"

type AuthFormProps = {
  mode: "signIn" | "signUp"
}

function errorMessage(error: unknown): string | null {
  if (error && typeof error === "object") {
    const e = error as {
      message?: unknown
      code?: unknown
      status?: unknown
      statusText?: unknown
    }
    if (typeof e.message === "string" && e.message) return e.message
    if (typeof e.code === "string" && e.code) return e.code
    if (typeof e.status === "number") {
      const statusText =
        typeof e.statusText === "string" && e.statusText
          ? ` ${e.statusText}`
          : ""
      return `${e.status}${statusText}`
    }
  }
  return null
}

export function AuthForm({ mode }: AuthFormProps) {
  const isSignUp = mode === "signUp"
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password })
      const message = errorMessage(result.error)
      if (result.error || !result.data) {
        throw new Error(message ?? `${isSignUp ? "Sign up" : "Sign in"} failed`)
      }
      router.push("/dashboard")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `${isSignUp ? "Sign up" : "Sign in"} failed`
      )
      setPending(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold">
          {isSignUp ? "Create Account" : "Sign In"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? isSignUp
                ? "Creating account…"
                : "Signing in…"
              : isSignUp
                ? "Create Account"
                : "Sign In"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account? " : "No account? "}
          <Link
            href={isSignUp ? "/login" : "/register"}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {isSignUp ? "Sign In" : "Register"}
          </Link>
        </p>
      </div>
    </div>
  )
}
