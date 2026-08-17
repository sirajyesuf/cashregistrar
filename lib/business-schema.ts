import { z } from "zod"

import { REGION_CODES } from "@/lib/regions"

export const morCredentialSchema = z.object({
  tin: z.string().trim().min(1, "TIN is required").max(40),
  vatNumber: z.string().trim().max(40),
  clientId: z.string().trim().min(1, "Client ID is required").max(200),
  clientSecret: z.string().trim().min(1, "Client secret is required").max(200),
  apiKey: z.string().trim().min(1, "API key is required").max(200),
  systemNumber: z.string().trim().min(1, "System number is required").max(80),
  systemType: z.string().trim().max(40),
})

const EIMS_EMAIL_REGEX = /^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$/
const ETHIOPIAN_PHONE_REGEX = /^(\+251|0)?[1-9]\d{8}$/
const POSITIVE_INT_REGEX = /^[1-9]\d*$/

const positiveIntegerField = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => value === "" || POSITIVE_INT_REGEX.test(value),
      `${label} must be an integer greater than 0`
    )

const sellerFields = {
  city: positiveIntegerField("City", 120),
  email: z
    .string()
    .trim()
    .max(160)
    .refine(
      (value) => value === "" || EIMS_EMAIL_REGEX.test(value),
      "Enter a valid email address"
    ),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine(
      (value) => value === "" || ETHIOPIAN_PHONE_REGEX.test(value),
      "Enter a valid Ethiopian phone number (e.g. +2519XXXXXXXX)"
    ),
  region: z.enum([...REGION_CODES, ""]),
  wereda: positiveIntegerField("Wereda", 120),
  country: z.string().trim().max(120),
  houseNumber: z.string().trim().max(120),
}

export const businessCreateSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(120),
  address: z.string().trim().max(240),
  ...sellerFields,
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

export const updateBusinessSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(240).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  active: z.boolean().optional(),
  city: positiveIntegerField("City", 120).optional(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(160)
    .nullable()
    .optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  region: z.enum([...REGION_CODES, ""]).nullable().optional(),
  wereda: positiveIntegerField("Wereda", 120).nullable().optional(),
  country: z.string().trim().max(120).optional(),
  houseNumber: z.string().trim().max(120).nullable().optional(),
})

export const businessUpdateApiSchema = updateBusinessSchema.extend({
  morCredential: morCredentialUpdateSchema.optional(),
})

export const updateBranchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(240).nullable().optional(),
  active: z.boolean().optional(),
})

export type MorCredentialValues = z.infer<typeof morCredentialSchema>
export type BusinessUpdateValues = z.infer<typeof businessUpdateApiSchema>
export type BranchUpdateValues = z.infer<typeof updateBranchSchema>
export type CreateBusinessApiValues = z.infer<typeof createBusinessApiSchema>
export type BusinessCreateValues = z.infer<typeof businessCreateSchema>
export type BranchCreateValues = z.infer<typeof branchCreateSchema>
export type CreateBusinessFormValues = z.infer<typeof createBusinessFormSchema>
