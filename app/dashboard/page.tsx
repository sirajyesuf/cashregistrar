"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user === null) router.push("/login")
  }, [user, router])

  if (!user) return null

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-lg font-bold">CashRegistrar</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <Button variant="outline" size="sm" onClick={() => { logout(); router.push("/login") }}>
            Sign Out
          </Button>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Welcome, {user.name}</h2>
          <p className="mt-2 text-muted-foreground">What would you like to do?</p>
          <div className="mt-6 flex gap-4">
            <Link href="/invoices">
              <Button size="lg">Create Invoice</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
