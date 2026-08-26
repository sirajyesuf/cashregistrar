import { z } from "zod"

import { TAX_CODE_CODES } from "@/lib/einvoice/tax"
import { UNIT_CODES } from "@/lib/units"

const EIMS_EMAIL_REGEX = /^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$/
const EIMS_TIN_REGEX = /^[0-9]{10,20}$/
const EIMS_REGION_REGEX = /^[0-9]{1,3}$/
const EIMS_PHONE_REGEX = /^\+?[0-9]{10}$/
const EIMS_VAT_NUMBER_REGEX = /^[0-9]{3,25}$/

/**
 * Optional buyer field: a missing value or an empty/whitespace-only string
 * resolves to the default (EIMS rejects empty buyer fields). Values are
 * trimmed; refinements chained after this run on the resolved value.
 */
const buyerField = (def: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? def : value))
    .default(def)

export const buyerSchema = z.object({
  city: buyerField("0"),
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
  houseNumber: buyerField("NEW").refine(
    (value) => value.length >= 3,
    "House number must be at least 3 characters long"
  ),
  idNumber: buyerField("11122222222222222").refine(
    (value) => value.length >= 1,
    "ID number must be at least 1 character long"
  ),
  idType: buyerField("KID").refine(
    (value) => value.length <= 3,
    "ID type must be at most 3 characters long"
  ),
  tin: buyerField("0999930000").refine(
    (value) => EIMS_TIN_REGEX.test(value),
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
  region: buyerField("13").refine(
    (value) => EIMS_REGION_REGEX.test(value),
    "Region must be 1 to 3 digits"
  ),
  country: buyerField("70"),
  zone: buyerField("SHA").refine(
    (value) => value.length >= 1,
    "Zone is required"
  ),
  kebele: buyerField("03").refine(
    (value) => value.length >= 1,
    "Kebele is required"
  ),
  vatNumber: buyerField("123475885858").refine(
    (value) => EIMS_VAT_NUMBER_REGEX.test(value),
    "VAT number must be 3 to 25 digits"
  ),
  wereda: buyerField("574").refine(
    (value) => value.length >= 1,
    "Wereda is required"
  ),
})

export type BuyerDetails = z.infer<typeof buyerSchema>

/**
 * Permissive buyer shapes used for B2C (and as the raw field for both types).
 * Every field is optional; only TIN and VAT number are validated, and only
 * when a non-empty value is supplied. Missing/empty values are normalized to
 * NULL at the persistence layer (see invoice.service).
 *
 * `buyerInputSchema` (API) also accepts `null` fields so a JSON client sending
 * `{ tin: null }` skips validation; `buyerFormSchema` matches the web form's
 * `Partial<BuyerDetails>` value type (strings only).
 */
const apiBuyerField = z.string().trim().nullable().optional()

export const buyerInputSchema = z.object({
  city: apiBuyerField,
  email: apiBuyerField,
  houseNumber: apiBuyerField,
  idNumber: apiBuyerField,
  idType: apiBuyerField,
  tin: apiBuyerField.refine(
    (value) => value == null || value === "" || EIMS_TIN_REGEX.test(value),
    "TIN must be 10 to 20 digits"
  ),
  legalName: apiBuyerField,
  phone: apiBuyerField,
  region: apiBuyerField,
  country: apiBuyerField,
  zone: apiBuyerField,
  kebele: apiBuyerField,
  vatNumber: apiBuyerField.refine(
    (value) => value == null || value === "" || EIMS_VAT_NUMBER_REGEX.test(value),
    "VAT number must be 3 to 25 digits"
  ),
  wereda: apiBuyerField,
})

export type BuyerInput = z.infer<typeof buyerInputSchema>

const formBuyerField = z.string().trim().optional()

export const buyerFormSchema = z.object({
  city: formBuyerField,
  email: formBuyerField,
  houseNumber: formBuyerField,
  idNumber: formBuyerField,
  idType: formBuyerField,
  tin: formBuyerField.refine(
    (value) => value == null || value === "" || EIMS_TIN_REGEX.test(value),
    "TIN must be 10 to 20 digits"
  ),
  legalName: formBuyerField,
  phone: formBuyerField,
  region: formBuyerField,
  country: formBuyerField,
  zone: formBuyerField,
  kebele: formBuyerField,
  vatNumber: formBuyerField.refine(
    (value) => value == null || value === "" || EIMS_VAT_NUMBER_REGEX.test(value),
    "VAT number must be 3 to 25 digits"
  ),
  wereda: formBuyerField,
})

/**
 * Whether the buyer block currently carries validation errors for the given
 * transaction type. B2B requires a full buyer; B2C only flags provided-but-
 * invalid TIN/VAT values (null/blank buyers are always valid).
 */
export function buyerHasIssues(
  transactionType: TransactionType,
  buyer: unknown
): boolean {
  if (buyer == null) return transactionType === "B2B"
  if (transactionType === "B2B") return !buyerSchema.safeParse(buyer).success
  return !buyerInputSchema.safeParse(buyer).success
}

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
    transactionType: transactionTypeSchema,
    buyer: buyerInputSchema.nullable().optional(),
    cashierName: z.string(),
    salesPersonName: z.string(),
    incomeWithholdRate: z
      .number()
      .finite()
      .min(0, "Income withhold rate must be between 0 and 100")
      .max(100, "Income withhold rate must be between 0 and 100")
      .optional(),
    lines: z
      .array(invoiceLineInputSchema)
      .min(1, "At least one line item is required"),
  })
  .superRefine((data, ctx) => {
    if (data.transactionType === "B2B") {
      if (data.buyer == null) {
        ctx.addIssue({
          code: "custom",
          path: ["buyer"],
          message: "Buyer details are required for B2B invoices",
        })
      } else {
        const buyerResult = buyerSchema.safeParse(data.buyer)
        if (!buyerResult.success) {
          for (const issue of buyerResult.error.issues) {
            ctx.addIssue({ ...issue, path: ["buyer", ...issue.path] })
          }
        }
      }
      if (data.incomeWithholdRate === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["incomeWithholdRate"],
          message: "Income withhold rate is required for B2B invoices",
        })
      }
    }
  })

export type InvoiceInput = z.infer<typeof invoiceInputSchema>

export const invoiceCreateApiSchema = invoiceInputSchema.and(
  z.object({
    branchId: z.string().trim().min(1, "Branch is required"),
  })
)

export type InvoiceCreateApiValues = z.infer<typeof invoiceCreateApiSchema>

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
    transactionType: transactionTypeSchema,
    buyer: buyerFormSchema,
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
  .refine((data) => !isFutureDate(data.date), {
    message: "Date cannot be in the future",
    path: ["date"],
  })
  .superRefine((data, ctx) => {
    if (data.transactionType === "B2B") {
      if (data.buyer == null) {
        ctx.addIssue({
          code: "custom",
          path: ["buyer"],
          message: "Buyer details are required for B2B invoices",
        })
      } else {
        const buyerResult = buyerSchema.safeParse(data.buyer)
        if (!buyerResult.success) {
          for (const issue of buyerResult.error.issues) {
            ctx.addIssue({ ...issue, path: ["buyer", ...issue.path] })
          }
        }
      }
    }
  })

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>
