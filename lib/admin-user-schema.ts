import { z } from "zod"
import { morCredentialSchema } from "@/lib/business-schema"

const businessSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(120),
  address: z.string().trim().max(240),
})

const branchSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required").max(120),
  address: z.string().trim().max(240),
})

export const adminUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address").max(160),
  password: z.string().min(5, "Password must be at least 5 characters"),
  role: z.enum(["ADMIN", "OWNER"]),
  business: businessSchema,
  morCredential: morCredentialSchema,
  branch: branchSchema,
})

export type AdminUserFormValues = z.infer<typeof adminUserSchema>
