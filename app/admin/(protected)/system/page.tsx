"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"

type SystemData = {
  businesses: {
    id: string
    name: string
    configured: boolean
    tin: string | null
    systemNumber: string | null
    _count: { branches: number }
  }[]
  config: {
    baseUrl: string
  }
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium break-all">
        {children}
      </span>
    </div>
  )
}

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/system")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load system info")
        setData(await res.json())
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load system info"
        )
      )
  }, [])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          MOR credentials and configuration per business.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Businesses</h2>
        </div>
        <div className="mt-3 divide-y">
          {data.businesses.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">None</p>
          )}
          {data.businesses.map((business) => (
            <Row key={business.id} label={business.name}>
              <span className="flex items-center gap-2">
                {business.configured ? (
                  <Badge variant="success">Configured</Badge>
                ) : (
                  <Badge variant="destructive">Missing</Badge>
                )}
                <span className="text-muted-foreground">
                  {business._count.branches} branch
                  {business._count.branches === 1 ? "" : "es"}
                </span>
              </span>
            </Row>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Config</h2>
        <div className="mt-3 divide-y">
          <Row label="Base URL">{data.config.baseUrl || "—"}</Row>
        </div>
      </div>
    </div>
  )
}
