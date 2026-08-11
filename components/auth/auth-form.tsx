"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { authClient } from "@/lib/auth-client"

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
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
      const result =
        mode === "signin"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: name.trim() || email,
            })
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Authentication failed")
      }
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed")
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
          {mode === "signin" ? "Sign In" : "Create Account"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={5}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
                ? "Sign In"
                : "Create Account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <a
            href={mode === "signin" ? "/register" : "/login"}
            className="font-medium text-primary hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in instead"}
          </a>
        </p>
      </div>
    </div>
  )
}
