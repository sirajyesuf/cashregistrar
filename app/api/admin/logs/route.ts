import { open, readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import { eimsLogDir } from "@/lib/einvoice/eims-logger"

export const runtime = "nodejs"

const FILE_PATTERN = /^eims-\d{4}-\d{2}-\d{2}\.log$/
const DEFAULT_LINES = 200
const MAX_LINES = 2000
const MAX_BYTES = 10 * 1024 * 1024

async function listLogFiles(): Promise<string[]> {
  try {
    const entries = await readdir(eimsLogDir(), { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && FILE_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a))
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status! })
  }

  const { searchParams } = new URL(request.url)
  const file = searchParams.get("file")

  if (!file) {
    return NextResponse.json({ files: await listLogFiles() })
  }

  if (!FILE_PATTERN.test(file)) {
    return NextResponse.json({ error: "Invalid log file" }, { status: 400 })
  }

  const dir = path.resolve(eimsLogDir())
  const resolved = path.resolve(dir, file)
  if (!resolved.startsWith(dir + path.sep)) {
    return NextResponse.json({ error: "Invalid log file" }, { status: 400 })
  }

  const linesParam = Number(searchParams.get("lines") ?? DEFAULT_LINES)
  const lineLimit = Number.isFinite(linesParam)
    ? Math.max(1, Math.min(MAX_LINES, Math.floor(linesParam)))
    : DEFAULT_LINES

  let raw: string
  try {
    const stats = await stat(resolved)
    if (stats.size > MAX_BYTES) {
      const handle = await open(resolved, "r")
      try {
        const buffer = Buffer.alloc(MAX_BYTES)
        const { bytesRead } = await handle.read(buffer, 0, MAX_BYTES, stats.size - MAX_BYTES)
        raw = buffer.subarray(0, bytesRead).toString("utf8")
        // Drop a possibly-partial first line from the tail read.
        const firstNewline = raw.indexOf("\n")
        if (firstNewline !== -1) raw = raw.slice(firstNewline + 1)
      } finally {
        await handle.close()
      }
    } else {
      raw = await readFile(resolved, "utf8")
    }
  } catch {
    return NextResponse.json({ error: "Log file not found" }, { status: 404 })
  }

  const allLines = raw.split("\n")
  while (allLines.length > 0 && allLines[allLines.length - 1] === "") {
    allLines.pop()
  }
  const totalLines = allLines.length
  const lines = allLines.slice(-lineLimit)

  return NextResponse.json({
    name: file,
    lines,
    totalLines,
    truncated: totalLines > lines.length,
  })
}
