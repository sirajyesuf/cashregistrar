import { z } from "zod"
import { UNIT_CODES } from "@/lib/units"

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  itemCode: z.string().trim(),
  unit: z.enum(UNIT_CODES),
  sellingPrice: z
    .number()
    .finite("Selling price must be a valid number")
    .nonnegative("Selling price cannot be negative"),
})

export type ProductInput = z.infer<typeof productInputSchema>
