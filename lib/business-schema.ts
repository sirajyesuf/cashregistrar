import { z } from "zod"

export const businessCreateSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(120),
  tin: z.string().trim().max(40),
  vatNumber: z.string().trim().max(40),
  address: z.string().trim().max(240),
})

export const branchCreateSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required").max(120),
  address: z.string().trim().max(240),
})

export const createBusinessApiSchema = businessCreateSchema.extend({
  branch: branchCreateSchema.optional(),
})

export const createBusinessFormSchema = businessCreateSchema.extend({
  branch: branchCreateSchema,
})

export type BusinessCreateValues = z.infer<typeof businessCreateSchema>
export type BranchCreateValues = z.infer<typeof branchCreateSchema>
export type CreateBusinessFormValues = z.infer<typeof createBusinessFormSchema>
