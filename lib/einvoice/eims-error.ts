/**
 * Helpers for interpreting EIMS error responses.
 *
 * Shared between the register and receipt routes so the document/receipt
 * counter self-heal behaves identically everywhere.
 */

/** Discriminator used to identify EIMS credential/config failures. */
export const EIMS_AUTH_CODE = "EIMS_AUTH"

/**
 * Raised when EIMS rejects our credentials (401 "Invalid Credentials") or when
 * a business has no MOR credentials configured at all. Distinct from EIMS
 * validation errors so routes and the UI can tell "fix your config" apart from
 * "fix the invoice".
 */
export class EimsAuthError extends Error {
  readonly code = EIMS_AUTH_CODE
  readonly eimsStatusCode: number | null

  constructor(message: string, eimsStatusCode: number | null = null) {
    super(message)
    this.name = "EimsAuthError"
    this.eimsStatusCode = eimsStatusCode
  }
}

export function isEimsAuthError(err: unknown): err is EimsAuthError {
  return (
    err instanceof EimsAuthError ||
    (Boolean(err) &&
      typeof err === "object" &&
      (err as { code?: unknown }).code === EIMS_AUTH_CODE)
  )
}

/**
 * Builds a clean, user-facing message for a credential failure, folding in the
 * EIMS reason (e.g. "Invalid Credentials") when it is known.
 */
export function eimsAuthMessage(reason?: string | null): string {
  const detail = reason && reason.trim() ? ` (${reason.trim()})` : ""
  return (
    "EIMS rejected your MOR credentials" +
    detail +
    ". Check the TIN, system number, API key, client ID and secret and try again."
  )
}

/** Flattens an EIMS error body into a readable message string. */
function flattenErrorMessage(item: unknown): string {
  if (typeof item === "string") return item
  if (!item || typeof item !== "object") return ""
  const o = item as {
    portion?: unknown
    tag?: unknown
    errorMessage?: unknown
    message?: unknown
  }
  const label = [o.portion, o.tag].find(
    (x): x is string => typeof x === "string" && x.length > 0
  )
  if (Array.isArray(o.errorMessage)) {
    const msgs = o.errorMessage
      .filter((m) => typeof m === "string" && m)
      .join("; ")
    return label ? `${label}: ${msgs}` : msgs
  }
  if (typeof o.message === "string" && o.message) {
    return label ? `${label}: ${o.message}` : o.message
  }
  return ""
}

export function extractErrorMessage(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as {
      message?: unknown
      details?: { errorMessage?: unknown }[]
      ruleError?: unknown
      body?: unknown
    }
    if (Array.isArray(d.details)) {
      const msg = d.details
        .map((x) => (typeof x.errorMessage === "string" ? x.errorMessage : ""))
        .filter(Boolean)
        .join("; ")
      if (msg) return msg
    }
    // EIMS bulk callback entries carry the errors under "ruleError"
    // (e.g. { docNo, status: "ERROR", ruleError: [{ portion, errorMessage }] }).
    if (Array.isArray(d.ruleError)) {
      const msgs = d.ruleError
        .map((item) => flattenErrorMessage(item))
        .filter(Boolean)
      if (msgs.length > 0) return msgs.join(" | ")
    }
    if (Array.isArray(d.body)) {
      const msgs = d.body
        .map((item) => flattenErrorMessage(item))
        .filter(Boolean)
      if (msgs.length > 0) return msgs.join(" | ")
      if (typeof d.body[0] === "object") return JSON.stringify(d.body[0])
    }
    if (d.body && typeof d.body === "object" && !Array.isArray(d.body)) {
      const o = d.body as {
        message?: unknown
        msg?: unknown
        status?: unknown
        unknownIrn?: unknown
        dataMissMuch?: unknown
        ruleErrorDto?: unknown
      }
      const parts: string[] = []
      if (typeof o.message === "string" && o.message) parts.push(o.message)
      if (typeof o.msg === "string" && o.msg) parts.push(o.msg)
      if (Array.isArray(o.unknownIrn)) {
        const irns = o.unknownIrn.filter(
          (x): x is string => typeof x === "string" && x.length > 0
        )
        if (irns.length > 0) parts.push(`Unknown IRN: ${irns.join(", ")}`)
      }
      if (Array.isArray(o.dataMissMuch)) {
        for (const item of o.dataMissMuch) {
          const msg = flattenErrorMessage(item)
          if (msg) parts.push(msg)
        }
      }
      if (Array.isArray(o.ruleErrorDto)) {
        for (const item of o.ruleErrorDto) {
          const msg = flattenErrorMessage(item)
          if (msg) parts.push(msg)
        }
      }
      if (parts.length > 0) return parts.join(" | ")
      if (o.status !== undefined) {
        return `${typeof d.message === "string" ? d.message : "EIMS"} (${String(o.status)})`
      }
    }
    if (typeof d.message === "string") return d.message
  }
  return "EIMS request failed"
}

export type EimsIssue = {
  portion: string
  messages: string[]
}

export type EimsError = {
  statusCode: number | null
  message: string
  issues: EimsIssue[]
  raw: string
}

/**
 * Parses an EIMS error response into a structured shape. Handles the common
 * single-document error bodies:
 *
 *  - { statusCode, message, body: [{ portion, errorMessage: [...] }] }
 *  - { body: { message | msg | status } }
 *  - { details: [{ errorMessage }] }
 *
 * Falls back to the flattened raw text when the shape is unrecognised.
 */
export function parseEimsError(data: unknown): EimsError {
  const raw = extractErrorMessage(data)
  const d =
    data && typeof data === "object"
      ? (data as {
          statusCode?: unknown
          message?: unknown
          body?: unknown
          details?: unknown
        })
      : {}

  const statusCode = typeof d.statusCode === "number" ? d.statusCode : null
  const message =
    typeof d.message === "string" ? d.message : "EIMS request failed"

  const issues: EimsIssue[] = []

  if (Array.isArray(d.body)) {
    for (const item of d.body) {
      if (typeof item === "string") {
        if (item) issues.push({ portion: "", messages: [item] })
        continue
      }
      if (!item || typeof item !== "object") continue
      const o = item as {
        portion?: unknown
        errorMessage?: unknown
        message?: unknown
      }
      const portion = typeof o.portion === "string" ? o.portion : ""
      const messages: string[] = []
      if (Array.isArray(o.errorMessage)) {
        for (const m of o.errorMessage) {
          if (typeof m === "string" && m) messages.push(m)
        }
      }
      if (typeof o.message === "string" && o.message) {
        messages.push(o.message)
      }
      if (messages.length > 0) issues.push({ portion, messages })
    }
  } else if (Array.isArray(d.details)) {
    for (const item of d.details) {
      if (!item || typeof item !== "object") continue
      const o = item as { errorMessage?: unknown }
      if (typeof o.errorMessage === "string" && o.errorMessage) {
        issues.push({ portion: "", messages: [o.errorMessage] })
      }
    }
  } else if (d.body && typeof d.body === "object" && !Array.isArray(d.body)) {
    const o = d.body as {
      unknownIrn?: unknown
      dataMissMuch?: unknown
      ruleErrorDto?: unknown
    }
    const collect = (list: unknown, labelKey: "portion" | "tag") => {
      if (!Array.isArray(list)) return
      for (const item of list) {
        if (!item || typeof item !== "object") continue
        const it = item as {
          portion?: unknown
          tag?: unknown
          errorMessage?: unknown
          message?: unknown
        }
        const label = typeof it[labelKey] === "string" ? it[labelKey] : ""
        const messages: string[] = []
        if (Array.isArray(it.errorMessage)) {
          for (const m of it.errorMessage) {
            if (typeof m === "string" && m) messages.push(m)
          }
        }
        if (typeof it.message === "string" && it.message) {
          messages.push(it.message)
        }
        if (messages.length > 0) issues.push({ portion: label, messages })
      }
    }
    collect(o.ruleErrorDto, "portion")
    collect(o.dataMissMuch, "tag")
    if (Array.isArray(o.unknownIrn)) {
      const irns = o.unknownIrn.filter(
        (x): x is string => typeof x === "string" && x.length > 0
      )
      if (irns.length > 0) {
        issues.push({ portion: "Unknown IRN", messages: irns })
      }
    }
  }

  return { statusCode, message, issues, raw }
}

/**
 * Returns true when the EIMS error message is a document/counter sequence
 * error (codes 7001 or 7015), i.e. the only errors the counter self-heal
 * understands.
 */
export function isSequenceError(message: string): boolean {
  return /7001|7015|sequence/i.test(message)
}

/**
 * Extracts the next expected sequence number from an EIMS error message,
 * e.g. "Document number is not in correct sequence expected : 11" returns 11.
 * Returns null when the pattern is absent.
 */
export function parseExpectedCounter(message: string): number | null {
  const match = message.match(/expected\s*:\s*(\d+)/i)
  return match ? Number(match[1]) : null
}

/**
 * Builds a user-facing message for an EIMS 429 rate-limit response, honouring
 * the `retry-after` header when it holds a number of seconds.
 */
export function rateLimitMessage(retryAfter: string | null): string {
  const seconds = retryAfterSeconds(retryAfter)
  const wait =
    seconds !== null
      ? `Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`
      : "Wait a moment and try again."
  return `EIMS rate limit reached (too many requests). ${wait}`
}

/**
 * Parses a `retry-after` value into a whole number of seconds to wait, or
 * `null` when the header is absent/unparseable. Accepts both a plain number of
 * seconds and an HTTP date.
 */
export function retryAfterSeconds(retryAfter: string | null): number | null {
  if (!retryAfter) return null
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
  const date = Date.parse(retryAfter)
  if (Number.isFinite(date)) {
    return Math.max(0, Math.ceil((date - Date.now()) / 1000))
  }
  return null
}
