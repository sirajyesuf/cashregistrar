/**
 * Helpers for interpreting EIMS error responses.
 *
 * Shared between the register and receipt routes so the document/receipt
 * counter self-heal behaves identically everywhere.
 */

/** Flattens an EIMS error body into a readable message string. */
function flattenErrorMessage(item: unknown): string {
  if (typeof item === "string") return item
  if (!item || typeof item !== "object") return ""
  const o = item as {
    portion?: unknown
    errorMessage?: unknown
    message?: unknown
  }
  if (Array.isArray(o.errorMessage)) {
    return o.errorMessage.filter((m) => typeof m === "string").join("; ")
  }
  if (typeof o.message === "string") return o.message
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
      const o = d.body as { message?: unknown; msg?: unknown; status?: unknown }
      if (typeof o.message === "string" && o.message) return o.message
      if (typeof o.msg === "string" && o.msg) return o.msg
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

  const statusCode =
    typeof d.statusCode === "number" ? d.statusCode : null
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
  }

  return { statusCode, message, issues, raw }
}

/**
 * Returns true when the EIMS error message is a document/counter sequence
 * error (codes 7001 or 7015), i.e. the only errors the counter self-heal
 * understands.
 */
export function isSequenceError(message: string): boolean {
  return /7001|7015/.test(message)
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
