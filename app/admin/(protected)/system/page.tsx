"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"

type SystemData = {
  token: {
    exists: boolean
    expiresAt: string | null
    updatedAt: string | null
    valid: boolean
  }
  counters: { name: string; value: number }[]
  config: {
    tin: string
    systemNumber: string
    systemType: string
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
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
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
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">EIMS token</h2>
          {data.token.valid ? (
            <Badge variant="success">Valid</Badge>
          ) : (
            <Badge variant="destructive">Invalid</Badge>
          )}
        </div>
        <div className="mt-3 divide-y">
          <Row label="Exists">{data.token.exists ? "Yes" : "No"}</Row>
          <Row label="Expires">
            {data.token.expiresAt
              ? new Date(data.token.expiresAt).toLocaleString()
              : "—"}
          </Row>
          <Row label="Updated">
            {data.token.updatedAt
              ? new Date(data.token.updatedAt).toLocaleString()
              : "—"}
          </Row>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Counters</h2>
        <div className="mt-3 divide-y">
          {data.counters.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">None</p>
          )}
          {data.counters.map((counter) => (
            <Row key={counter.name} label={counter.name}>
              {counter.value}
            </Row>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Config</h2>
        <div className="mt-3 divide-y">
          <Row label="TIN">{data.config.tin || "—"}</Row>
          <Row label="System number">{data.config.systemNumber || "—"}</Row>
          <Row label="System type">{data.config.systemType || "—"}</Row>
          <Row label="Base URL">{data.config.baseUrl || "—"}</Row>
        </div>
      </div>
    </div>
  )
}
