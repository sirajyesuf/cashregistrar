import { invoiceCreateApiSchema, invoiceInputSchema } from "@/lib/invoice-schema"

export const invoicePublicCreateSchema = invoiceCreateApiSchema
export const invoicePublicUpdateSchema = invoiceInputSchema

export type InvoicePublicCreateInput = typeof invoicePublicCreateSchema.type
export type InvoicePublicUpdateInput = typeof invoicePublicUpdateSchema.type