import { z } from "zod"

import { TAX_CODE_CODES, rateForTaxCode } from "@/lib/einvoice/tax"
import { UNIT_CODES } from "@/lib/units"

const EIMS_EMAIL_REGEX = /^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$/
const EIMS_TIN_REGEX = /^[0-9]{10,20}$/
const EIMS_REGION_REGEX = /^[0-9]{1,3}$/
const EIMS_PHONE_REGEX = /^\+?[0-9]{10}$/
const EIMS_VAT_NUMBER_REGEX = /^[0-9]{3,25}$/

export const buyerSchema = z.object({
  city: z.string(),
  email: z
    .string()
    .refine(
      (value) => EIMS_EMAIL_REGEX.test(value.trim()),
      "Enter a valid email address"
    )
    .refine(
      (value) => value.trim().length >= 6,
      "Email must be at least 6 characters long"
    ),
  houseNumber: z
    .string()
    .refine(
      (value) => value.trim().length >= 3,
      "House number must be at least 3 characters long"
    ),
  idNumber: z
    .string()
    .trim()
    .min(1, "ID number must be at least 1 character long"),
  idType: z.string().max(3, "ID type must be at most 3 characters long"),
  tin: z
    .string()
    .refine(
      (value) => EIMS_TIN_REGEX.test(value.trim()),
      "TIN must be 10 to 20 digits"
    ),
  legalName: z
    .string()
    .trim()
    .min(1, "The buyer's legal name is required"),
  phone: z
    .string()
    .refine(
      (value) => EIMS_PHONE_REGEX.test(value.trim()),
      "Phone must be 10 digits"
    ),
  region: z
    .string()
    .refine(
      (value) => EIMS_REGION_REGEX.test(value.trim()),
      "Region must be 1 to 3 digits"
    ),
  country: z.string(),
  zone: z.string().trim().min(1, "Zone is required"),
  kebele: z.string().trim().min(1, "Kebele is required"),
  vatNumber: z
    .string()
    .refine(
      (value) => EIMS_VAT_NUMBER_REGEX.test(value.trim()),
      "VAT number must be 3 to 25 digits"
    )
    .refine(
      (value) => value.trim().length >= 3,
      "VAT number must be at least 3 characters long"
    ),
  wereda: z.string().trim().min(1, "Wereda is required"),
})

export type BuyerDetails = z.infer<typeof buyerSchema>

export const transactionTypeSchema = z.enum(["B2B", "B2C"])
export type TransactionType = z.infer<typeof transactionTypeSchema>

export const invoiceLineInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(3, "Item descriptions must be at least 3 characters"),
  quantity: z
    .number()
    .finite()
    .positive("Every line item needs a quantity greater than zero"),
  unitPriceCents: z
    .number()
    .finite()
    .nonnegative("Unit price cannot be negative"),
  itemCode: z.string().trim(),
  unit: z.enum(UNIT_CODES),
})

export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>

export const invoiceInputSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "A valid date is required"),
    taxCode: z.enum(TAX_CODE_CODES),
    taxRate: z
      .number()
      .finite()
      .nonnegative("Tax rate cannot be negative")
      .max(1, "Tax rate must be at most 100%"),
    transactionType: transactionTypeSchema,
    buyer: buyerSchema,
    cashierName: z.string(),
    salesPersonName: z.string(),
    incomeWithholdRate: z
      .number()
      .finite()
      .min(0, "Income withhold rate must be between 0 and 100")
      .max(100, "Income withhold rate must be between 0 and 100"),
    lines: z
      .array(invoiceLineInputSchema)
      .min(1, "At least one line item is required"),
  })
  .superRefine((data, ctx) => {
    if (data.taxRate !== rateForTaxCode(data.taxCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["taxRate"],
        message: "Tax rate does not match the selected tax code",
      })
    }
  })

export type InvoiceInput = z.infer<typeof invoiceInputSchema>

export function isFutureDate(date: string): boolean {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`
  return date > today
}

export const invoiceFormLineSchema = z.object({
  id: z.string(),
  productId: z.string(),
  description: z
    .string()
    .trim()
    .min(3, "Item descriptions must be at least 3 characters"),
  quantity: z
    .string()
    .refine((value) => Number(value) > 0, "Every line item needs a quantity greater than zero"),
  unitPrice: z
    .string()
    .refine(
      (value) => value.trim() === "" || Number.isFinite(Number(value)),
      "Unit prices must be valid numbers"
    )
    .refine(
      (value) => value.trim() === "" || Number(value) >= 0,
      "Unit price cannot be negative"
    ),
  itemCode: z.string(),
  unit: z.enum(UNIT_CODES),
})

export type InvoiceFormLine = z.infer<typeof invoiceFormLineSchema>

export const invoiceFormSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "A valid date is required"),
    taxCode: z.enum(TAX_CODE_CODES),
    taxRate: z
      .number()
      .nonnegative("Tax rate cannot be negative")
      .max(1, "Tax rate must be at most 100%"),
    transactionType: transactionTypeSchema,
    buyer: buyerSchema,
    cashierName: z.string(),
    salesPersonName: z.string(),
    incomeWithholdRate: z
      .number()
      .min(0, "Income withhold rate must be between 0 and 100")
      .max(100, "Income withhold rate must be between 0 and 100"),
    lines: z
      .array(invoiceFormLineSchema)
      .min(1, "At least one line item is required"),
  })
  .superRefine((data, ctx) => {
    if (data.taxRate !== rateForTaxCode(data.taxCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["taxRate"],
        message: "Tax rate does not match the selected tax code",
      })
    }
  })
  .refine((data) => !isFutureDate(data.date), {
    message: "Date cannot be in the future",
    path: ["date"],
  })

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>
