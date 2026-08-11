import { z } from "zod"

export const morCredentialSchema = z.object({
  tin: z.string().trim().min(1, "TIN is required").max(40),
  vatNumber: z.string().trim().max(40),
  clientId: z.string().trim().min(1, "Client ID is required").max(200),
  clientSecret: z
    .string()
    .trim()
    .min(1, "Client secret is required")
    .max(200),
  apiKey: z.string().trim().min(1, "API key is required").max(200),
  systemNumber: z
    .string()
    .trim()
    .min(1, "System number is required")
    .max(80),
  systemType: z.string().trim().max(40),
})

export const businessCreateSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(120),
  address: z.string().trim().max(240),
})

export const businessEditSchema = businessCreateSchema.extend({
  morCredential: z.object({
    tin: z.string().trim().max(40),
    vatNumber: z.string().trim().max(40),
    clientId: z.string().trim().max(200),
    clientSecret: z.string().trim().max(200),
    apiKey: z.string().trim().max(200),
    systemNumber: z.string().trim().max(80),
    systemType: z.string().trim().max(40),
  }),
})

export const branchCreateSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required").max(120),
  address: z.string().trim().max(240),
})

export const createBusinessApiSchema = businessCreateSchema.extend({
  morCredential: morCredentialSchema,
  branch: branchCreateSchema.optional(),
})

export const createBusinessFormSchema = businessCreateSchema.extend({
  morCredential: morCredentialSchema,
  branch: branchCreateSchema,
})

export const morCredentialUpdateSchema = morCredentialSchema.partial()

export type MorCredentialValues = z.infer<typeof morCredentialSchema>
export type BusinessCreateValues = z.infer<typeof businessCreateSchema>
export type BranchCreateValues = z.infer<typeof branchCreateSchema>
export type CreateBusinessFormValues = z.infer<typeof createBusinessFormSchema>
