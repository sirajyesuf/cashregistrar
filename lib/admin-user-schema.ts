import { z } from "zod"

export const adminUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address").max(160),
  password: z.string().min(5, "Password must be at least 5 characters"),
  role: z.enum(["ADMIN", "OWNER"]),
})

export type AdminUserFormValues = z.infer<typeof adminUserSchema>
