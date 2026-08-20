import { appendFile, mkdir } from "node:fs/promises"
import path from "node:path"

/**
 * Append-only JSONL logger for EIMS traffic. Every request and response that
 * touches the MOR e-invoicing system is written as one JSON object per line so
 * the raw conversation can be inspected and replayed for debugging.
 *
 * - Daily rotation: logs/eims-YYYY-MM-DD.log (directory from EIMS_LOG_DIR).
 * - Gated by EIMS_LOG_ENABLED (defaults to on).
 * - Sensitive values are redacted before writing (tokens, client secrets,
 *   API keys) and base64 QR payloads are dropped entirely.
 * - Writes are serialized through an in-process queue so concurrent requests
 *   never interleave a line.
 */

type EimsLogDirection = "exchange" | "callback"

export type EimsLogEntry = {
  ts: string
  direction: EimsLogDirection
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

const SENSITIVE_KEY = /token|secret|apikey|api[_-]?key|password|authorization/i
const DROPPED_KEY = /^qr$/i

function maskToken(token: string): string {
  if (token.length <= 8) return "********"
  return `${token.slice(0, 4)}…${token.slice(-4)}`
}

/**
 * Returns a deep copy with sensitive values masked and bulky/secret fields
 * removed. Only recurses into plain objects and arrays; other values are
 * returned as-is.
 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (DROPPED_KEY.test(key)) continue
      if (SENSITIVE_KEY.test(key) && typeof item === "string") {
        out[key] = maskToken(item)
      } else {
        out[key] = redact(item)
      }
    }
    return out
  }
  return value
}

function isEnabled(): boolean {
  const raw = process.env.EIMS_LOG_ENABLED ?? "true"
  return !/^(0|false|no|off)$/i.test(raw.trim())
}

function logDir(): string {
  return process.env.EIMS_LOG_DIR ?? "logs"
}

/** Directory the EIMS logger writes to, shared with the admin log viewer. */
export function eimsLogDir(): string {
  return logDir()
}

function logPath(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return path.join(logDir(), `eims-${year}-${month}-${day}.log`)
}

let dirReady: Promise<void> | null = null
let writeQueue: Promise<void> = Promise.resolve()

function ensureDir(): Promise<void> {
  if (!dirReady) {
    dirReady = mkdir(logDir(), { recursive: true })
      .then(() => {})
      .catch(() => {})
  }
  return dirReady
}

function append(line: string): void {
  writeQueue = writeQueue
    .then(async () => {
      await ensureDir()
      await appendFile(logPath(), line, "utf8")
    })
    .catch(() => {
      // Logging must never break the request it describes.
    })
}

/**
 * Appends one EIMS log entry as a JSON line. Safe to call from any Node
 * runtime; it is non-blocking and swallows its own errors.
 */
export function logEims(entry: Omit<EimsLogEntry, "ts">): void {
  if (!isEnabled()) return
  const record: EimsLogEntry = { ts: new Date().toISOString(), ...entry }
  let line: string
  try {
    line = `${JSON.stringify(redact(record))}\n`
  } catch {
    return
  }
  append(line)
}
