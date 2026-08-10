"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Building2, CheckCircle2, Clock, Eye, EyeOff, Store } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type InviteInfo = {
  email: string
  role: "MANAGER" | "CASHIER"
  businessName: string
  branchName: string | null
  invitedByName: string | null
}

type InviteLookup = {
  valid: boolean
  error?: string
  invite?: InviteInfo
}

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager",
  CASHIER: "Cashier",
}

function InviteErrorCard({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Clock className="size-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Link href="/" className="mt-6 inline-block">
            <Button variant="outline">Go to CashRegistrar</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function InvitePageContent({ token }: { token: string }) {
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isPending } = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const res = await fetch(`/api/invitations/${token}`)
      const body = (await res.json()) as InviteLookup
      return body
    },
  })

  const user = session?.user ?? null
  const invite = data?.invite
  const emailMatches =
    invite && user && user.email.toLowerCase() === invite.email.toLowerCase()

  const accept = async (): Promise<void> => {
    const res = await fetch(`/api/invitations/${token}/accept`, { method: "POST" })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      throw new Error(body.error ?? `Could not accept invitation (${res.status})`)
    }
  }

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!invite) return
    setError(null)
    setPending(true)
    try {
      if (mode === "signin") {
        const result = await authClient.signIn.email({
          email: invite.email,
          password,
        })
        if (result.error || !result.data) {
          throw new Error(result.error?.message ?? "Sign in failed")
        }
      } else {
        const result = await authClient.signUp.email({
          email: invite.email,
          password,
          name: name.trim() || invite.email,
        })
        if (result.error || !result.data) {
          throw new Error(result.error?.message ?? "Sign up failed")
        }
      }
      await accept()
      toast.add({
        title: "Welcome to the team",
        description: `You joined ${invite.businessName}.`,
        type: "success",
      })
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setPending(false)
    }
  }

  const handleAccept = async () => {
    if (!invite) return
    setError(null)
    setPending(true)
    try {
      await accept()
      toast.add({
        title: "Welcome to the team",
        description: `You joined ${invite.businessName}.`,
        type: "success",
      })
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setPending(false)
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <div className="h-32 animate-pulse rounded-xl border bg-muted/50" />
        </div>
      </div>
    )
  }

  const messages: Record<string, { title: string; message: string }> = {
    invalid: {
      title: "Invitation not found",
      message: "This invite link is not valid. Ask the person who invited you for a new link.",
    },
    accepted: {
      title: "Already accepted",
      message: "This invitation has already been used.",
    },
    cancelled: {
      title: "Invitation cancelled",
      message: "This invitation was cancelled by the business owner.",
    },
    expired: {
      title: "Invitation expired",
      message: "This invite link has expired. Ask the business owner to send a new one.",
    },
  }

  if (!data) {
    const state = messages.invalid
    return <InviteErrorCard {...state} />
  }

  if (!data.valid) {
    const state = messages[data.error ?? "invalid"] ?? messages.invalid
    return <InviteErrorCard {...state} />
  }

  const loadingAuth = sessionPending
  const needsAccount = !loadingAuth && !user

  return (
    <div className="relative flex min-h-svh items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">
            You&apos;re invited to {invite!.businessName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {invite!.invitedByName ?? "Someone"} invited you to join their team.
          </p>

          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">
                {ROLE_LABELS[invite!.role] ?? invite!.role}
              </dd>
            </div>
            {invite!.branchName && (
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Store className="size-3.5" />
                  Branch
                </dt>
                <dd className="font-medium">{invite!.branchName}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Invited as</dt>
              <dd className="font-medium">{invite!.email}</dd>
            </div>
          </dl>

          <div className="mt-6">
            {loadingAuth ? (
              <div className="flex h-10 items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : needsAccount ? (
              <>
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={invite!.email}
                      readOnly
                      tabIndex={-1}
                    />
                  </div>
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="invite-name">Full name</Label>
                      <Input
                        id="invite-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        placeholder="Your full name"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="invite-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="invite-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={
                          mode === "signin" ? "current-password" : "new-password"
                        }
                        className="pr-11"
                        minLength={5}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute top-1/2 right-1 -translate-y-1/2"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending
                      ? "Joining…"
                      : mode === "signin"
                        ? "Sign in & join"
                        : "Create account & join"}
                  </Button>
                </form>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setMode(mode === "signin" ? "signup" : "signin")
                      setError(null)
                    }}
                  >
                    {mode === "signin" ? "Create an account" : "Sign in instead"}
                  </button>
                </p>
              </>
            ) : emailMatches ? (
              <>
                {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
                <Button
                  className="w-full"
                  disabled={pending}
                  onClick={handleAccept}
                >
                  <CheckCircle2 className="size-4" />
                  {pending ? "Joining…" : "Accept invitation"}
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                  <p className="font-medium">Signed in as a different account</p>
                  <p className="mt-1">
                    You&apos;re signed in as {user?.email}, but this invitation is
                    for {invite!.email}. Sign in with the invited account to
                    accept.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={async () => {
                    await authClient.signOut()
                    setError(null)
                  }}
                >
                  Sign out and switch account
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InvitePage() {
  const params = useParams<{ token: string }>()
  return <InvitePageContent token={params.token} />
}
