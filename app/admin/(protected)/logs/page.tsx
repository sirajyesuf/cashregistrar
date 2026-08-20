"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/toast"
import { copyText } from "@/lib/copy"

type LogEntry = {
  ts?: string
  direction?: string
  businessId?: string
  method?: string
  path?: string
  status?: number
  durationMs?: number
  attempt?: number
  payload?: unknown
  response?: unknown
  error?: string
}

type FileContent = {
  name: string
  lines: string[]
  totalLines: number
  truncated: boolean
  businesses?: Record<string, string>
}

function directionStyle(direction?: string): string {
  switch (direction) {
    case "exchange":
      return "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
    case "callback":
      return "border-transparent bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
    default:
      return "border-transparent bg-muted text-muted-foreground"
  }
}

function statusStyle(status?: number): string {
  if (status == null) {
    return "border-transparent bg-muted text-muted-foreground"
  }
  if (status >= 200 && status < 300) {
    return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
  }
  if (status === 429) {
    return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
  }
  return "border-transparent bg-destructive/10 text-destructive"
}

function parseEntry(line: string): { raw: string; entry: LogEntry | null } {
  try {
    const entry = JSON.parse(line) as LogEntry
    return { raw: line, entry }
  } catch {
    return { raw: line, entry: null }
  }
}

function LogEntryCard({
  raw,
  entry,
  expanded,
  onToggle,
  businessNames,
}: {
  raw: string
  entry: LogEntry | null
  expanded: boolean
  onToggle: () => void
  businessNames: Record<string, string>
}) {
  const pretty = useMemo(
    () => (entry ? JSON.stringify(entry, null, 2) : raw),
    [entry, raw]
  )

  const handleCopy = async (text: string, label: string) => {
    try {
      await copyText(text)
      toast.add({ title: "Copied", description: label, type: "success" })
    } catch {
      toast.add({
        title: "Copy failed",
        description: "Clipboard unavailable",
        type: "destructive",
      })
    }
  }

  const meta = entry ? `${entry.method ?? ""} ${entry.path ?? ""}`.trim() : raw

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
      >
        <span className="text-muted-foreground">
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
        <Badge className={directionStyle(entry?.direction)}>
          {entry?.direction ?? "line"}
        </Badge>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {meta || "—"}
        </span>
        {entry?.status != null && (
          <Badge className={statusStyle(entry.status)}>{entry.status}</Badge>
        )}
        {entry?.ts && (
          <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
            {new Date(entry.ts).toLocaleString()}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t bg-muted/20">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {entry?.businessId && (
                <span className="font-mono">
                  business: {businessNames[entry.businessId] ?? entry.businessId}
                </span>
              )}
              {entry?.durationMs != null && <span>{entry.durationMs} ms</span>}
              {entry?.attempt != null && <span>attempt {entry.attempt}</span>}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => handleCopy(pretty, "Pretty JSON copied")}
              >
                <Copy className="size-3.5" />
                Copy JSON
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => handleCopy(raw, "Raw line copied")}
              >
                <Copy className="size-3.5" />
                Copy raw
              </Button>
            </div>
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground/90">
            {pretty}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function AdminLogsPage() {
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState<string>("")
  const [content, setContent] = useState<FileContent | null>(null)
  const [requestedLines, setRequestedLines] = useState(200)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [expandedAll, setExpandedAll] = useState(false)

  const fetchContent = useCallback(async (file: string, lines: number) => {
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/logs?file=${encodeURIComponent(file)}&lines=${lines}`
      )
      if (!res.ok) throw new Error("Failed to load log content")
      setContent((await res.json()) as FileContent)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load log content")
    }
  }, [])

  const loadFileList = useCallback(async (): Promise<string[]> => {
    const res = await fetch("/api/admin/logs")
    if (!res.ok) throw new Error("Failed to load log files")
    const body = (await res.json()) as { files: string[] }
    return body.files
  }, [])

  const refreshFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await loadFileList()
      setFiles(list)
      const next = list[0] ?? ""
      setSelected(next)
      setRequestedLines(200)
      setExpanded({})
      setExpandedAll(false)
      if (next) await fetchContent(next, 200)
      else setContent(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load log files")
    } finally {
      setLoading(false)
    }
  }, [loadFileList, fetchContent])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await loadFileList()
        if (cancelled) return
        setFiles(list)
        const next = list[0] ?? ""
        setSelected(next)
        setRequestedLines(200)
        if (next) await fetchContent(next, 200)
        else setContent(null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load log files")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadFileList, fetchContent])

  const selectFile = (file: string) => {
    if (!file || file === selected) return
    setSelected(file)
    setRequestedLines(200)
    setExpanded({})
    setExpandedAll(false)
    fetchContent(file, 200)
  }

  const entries = useMemo(
    () => (content ? content.lines.map(parseEntry).reverse() : []),
    [content]
  )

  const copyAll = async () => {
    if (!content) return
    try {
      await copyText(content.lines.join("\n"))
      toast.add({
        title: "Copied",
        description: `${content.lines.length} lines copied`,
        type: "success",
      })
    } catch {
      toast.add({
        title: "Copy failed",
        description: "Clipboard unavailable",
        type: "destructive",
      })
    }
  }

  const toggleAll = () => {
    if (!content) return
    const next = !expandedAll
    const map: Record<string, boolean> = {}
    for (let i = 0; i < content.lines.length; i++) map[String(i)] = next
    setExpanded(map)
    setExpandedAll(next)
  }

  const loadMore = () => {
    if (!selected) return
    const next = requestedLines + 200
    setRequestedLines(next)
    fetchContent(selected, next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileText className="size-6 text-muted-foreground" />
          EIMS Logs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raw request/response traffic with the MOR e-invoicing system.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={selected} onValueChange={(value) => selectFile(value ?? "")}>
          <SelectTrigger className="w-64" aria-label="Log file">
            <SelectValue placeholder="Select a log file" />
          </SelectTrigger>
          <SelectContent>
            {files.map((file) => (
              <SelectItem key={file} value={file}>
                {file}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={refreshFiles}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
        {content && content.lines.length > 0 && (
          <>
            <Button type="button" variant="outline" onClick={copyAll}>
              <Copy data-icon="inline-start" />
              Copy file
            </Button>
            <Button type="button" variant="ghost" onClick={toggleAll}>
              {expandedAll ? "Collapse all" : "Expand all"}
            </Button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-medium">No log files yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            EIMS traffic is logged to <span className="font-mono">logs/</span>{" "}
            once requests are made.
          </p>
        </div>
      ) : content && content.lines.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">This file is empty.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {content && (
            <p className="text-xs text-muted-foreground">
              Showing {entries.length} of {content.totalLines} lines
              {content.truncated && " (tail)"}
            </p>
          )}
          {entries.map(({ raw, entry }, i) => (
            <LogEntryCard
              key={`${content?.name}-${i}`}
              raw={raw}
              entry={entry}
              expanded={Boolean(expanded[String(i)])}
              onToggle={() =>
                setExpanded((prev) => ({ ...prev, [String(i)]: !prev[String(i)] }))
              }
              businessNames={content?.businesses ?? {}}
            />
          ))}
          {content && content.truncated && (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="outline" onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
