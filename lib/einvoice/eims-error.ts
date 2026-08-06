/**
 * Helpers for interpreting EIMS error responses.
 *
 * Shared between the register and receipt routes so the document/receipt
 * counter self-heal behaves identically everywhere.
 */

/** Flattens an EIMS error body into a readable message string. */
export function extractErrorMessage(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as {
      message?: unknown
      details?: { errorMessage?: unknown }[]
      body?: unknown
    }
    if (Array.isArray(d.details)) {
      const msg = d.details
        .map((x) => (typeof x.errorMessage === "string" ? x.errorMessage : ""))
        .filter(Boolean)
        .join("; ")
      if (msg) return msg
    }
    if (Array.isArray(d.body)) {
      const msgs = d.body
        .map((item) => {
          if (item && typeof item === "object") {
            const o = item as {
              portion?: unknown
              errorMessage?: unknown
              message?: unknown
            }
            if (Array.isArray(o.errorMessage)) {
              return o.errorMessage
                .filter((m) => typeof m === "string")
                .join("; ")
            }
            if (typeof o.message === "string") return o.message
          }
          if (typeof item === "string") return item
          return ""
        })
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
