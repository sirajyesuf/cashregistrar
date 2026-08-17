import { z } from "zod"

export const cancelInputSchema = z.object({
  reason: z.string().optional(),
  remark: z.string().optional(),
})

export const bulkIdsSchema = z.object({
  invoiceIds: z
    .array(z.string().trim().min(1, "Invoice id is required"))
    .min(1, "At least one invoice is required")
    .max(50, "A maximum of 50 invoices can be submitted at once"),
})

export const bulkCancelSchema = bulkIdsSchema.extend({
  reason: z.string().optional(),
  remark: z.string().optional(),
})

export type CancelInput = z.infer<typeof cancelInputSchema>
export type BulkIdsInput = z.infer<typeof bulkIdsSchema>
export type BulkCancelInput = z.infer<typeof bulkCancelSchema>
