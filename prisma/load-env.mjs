import { existsSync, readFileSync } from "node:fs"

/**
 * Loads .env / .env.local so seed scripts work when run directly via
 * `node` (which, unlike the `prisma` CLI, does not auto-load them).
 * Already-set env vars (e.g. injected by a host) take precedence.
 */
export function loadEnv() {
  if (process.env.DATABASE_URL) return
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "")
      }
    }
  }
}
