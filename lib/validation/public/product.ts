import { z } from "zod"
import { UNIT_CODES } from "@/lib/units"

export const productPublicSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  itemCode: z.string().trim(),
  unit: z.enum(UNIT_CODES),
  price: z
    .number()
    .finite("Price must be a valid number")
    .nonnegative("Price cannot be negative"),
})

export type ProductPublicInput = z.infer<typeof productPublicSchema>