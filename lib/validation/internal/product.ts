import { z } from "zod"
import { UNIT_CODES } from "@/lib/units"

export const productInternalSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  itemCode: z.string().trim(),
  unit: z.enum(UNIT_CODES),
  sellingPrice: z
    .number()
    .finite("Selling price must be a valid number")
    .nonnegative("Selling price cannot be negative"),
})

export type ProductInternalInput = z.infer<typeof productInternalSchema>