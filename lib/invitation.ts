import { createHash, randomBytes } from "crypto"
import { z } from "zod"

export const INVITE_EXPIRY_DAYS = 7

export const invitationCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(["MANAGER", "CASHIER"] as const),
  branchId: z.string().trim().min(1, "Select a branch"),
})

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function buildInviteUrl(token: string): string {
  const base =
    process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${base.replace(/\/+$/, "")}/invite/${token}`
}

export function invitationExpiry(): Date {
  const date = new Date()
  date.setDate(date.getDate() + INVITE_EXPIRY_DAYS)
  return date
}
