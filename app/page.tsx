"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

export default function Page() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) router.push("/dashboard")
  }, [user, router])

  if (user) return null

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">CashRegistrar</h1>
        <p className="mt-2 text-muted-foreground">Invoice Generator</p>
      </div>
      <div className="flex gap-4">
        <Link href="/login">
          <Button variant="outline" size="lg">Sign In</Button>
        </Link>
        <Link href="/register">
          <Button size="lg">Create Account</Button>
        </Link>
      </div>
    </div>
  )
}
